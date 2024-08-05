import fs from "fs-extra"
import parseArgs from "minimist"
import {
    DeleteObjectCommand,
    DeleteObjectCommandInput,
    ListObjectsCommand,
    ListObjectsV2Command,
    ListObjectsV2CommandOutput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3"
import {
    GRAPHER_CONFIG_R2_BUCKET,
    GRAPHER_CONFIG_R2_BUCKET_PATH,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import {
    knexRaw,
    KnexReadonlyTransaction,
    knexReadonlyTransaction,
} from "../../db/db.js"
import {
    base64ToBytes,
    bytesToBase64,
    DbRawChartConfig,
    differenceOfSets,
    excludeUndefined,
    HexString,
    hexToBytes,
    R2GrapherConfigDirectory,
} from "@ourworldindata/utils"
import { string } from "ts-pattern/dist/patterns.js"
import { chunk, take } from "lodash"
import ProgressBar from "progress"

type HashAndId = Pick<DbRawChartConfig, "fullMd5" | "id">

/** Sync a set of chart configs with R2. Pass in a map of the keys to their md5 hashes and UUIDs
    and this function will upsert all missing/outdated ones and delete any that are no longer needed.

    @param s3Client The S3 client to use
    @param pathPrefix The path prefix to use for the files (e.g. "config/by-uuid" then everything inside it will be synced)
    @param hashesOfFilesToToUpsert A map of the keys to their md5 hashes and UUIDs
    @param trx The transaction to use for querying the DB for full configs
    @param dryRun Whether to actually make changes to R2 or just log what would
 */
async function syncWithR2(
    s3Client: S3Client,
    pathPrefix: string,
    hashesOfFilesToToUpsert: Map<string, HashAndId>,
    trx: KnexReadonlyTransaction,
    dryRun: boolean = false
) {
    // We'll first get all the files in the R2 bucket under the path prefix
    // and check if the hash of each file that exist in R2 matches the hash
    // of the file we want to upsert. If it does, we'll remove it from the
    // list of files to upsert. If it doesn't, we'll add it to the list of
    // files to delete.

    const hashesOfFilesToDelete = new Map<string, string>()

    // list the files in the R2 bucket. There may be more files in the
    // bucket than can be returned in one list operation so loop until
    // all files are listed
    let continuationToken: string | undefined = undefined
    do {
        const listObjectsCommandInput = {
            Bucket: GRAPHER_CONFIG_R2_BUCKET,
            Prefix: pathPrefix,
            ContinuationToken: continuationToken,
        }
        const listObjectsCommandOutput: ListObjectsV2CommandOutput =
            await s3Client.send(
                new ListObjectsV2Command(listObjectsCommandInput)
            )
        if ((listObjectsCommandOutput.Contents?.length ?? 0) > 0) {
            listObjectsCommandOutput.Contents!.forEach((object) => {
                if (object.Key && object.ETag) {
                    // For some reason the etag has quotes around it, strip those
                    const md5 = object.ETag.replace(/"/g, "") as HexString
                    const md5Base64 = bytesToBase64(hexToBytes(md5))

                    if (hashesOfFilesToToUpsert.has(object.Key)) {
                        if (
                            hashesOfFilesToToUpsert.get(object.Key)?.fullMd5 ===
                            md5Base64
                        ) {
                            hashesOfFilesToToUpsert.delete(object.Key)
                        }
                        // If the existing full config in R2 is different then
                        // we just keep the hashesOfFilesToToUpsert entry around
                        // which will upsert the new full config later on
                    } else {
                        // if the file in R2 is not in the list of files to upsert
                        // then we should delete it
                        hashesOfFilesToDelete.set(object.Key, md5Base64)
                    }
                }
            })
        }
        continuationToken = listObjectsCommandOutput.NextContinuationToken
    } while (continuationToken)

    console.log("Number of files to upsert", hashesOfFilesToToUpsert.size)
    console.log("Number of files to delete", hashesOfFilesToDelete.size)

    let progressBar = new ProgressBar(
        "--- Deleting obsolete configs [:bar] :current/:total :elapseds\n",
        {
            total: hashesOfFilesToDelete.size,
        }
    )

    // Delete the files in R2 that are no longer needed
    for (const batch of chunk([...hashesOfFilesToDelete.entries()], 100)) {
        const deletePromises = batch.map(async ([key, _]) => {
            const deleteObjectCommandInput: DeleteObjectCommandInput = {
                Bucket: GRAPHER_CONFIG_R2_BUCKET,
                Key: key,
            }
            if (!dryRun)
                await s3Client.send(
                    new DeleteObjectCommand(deleteObjectCommandInput)
                )
            else console.log("Would have deleted", key)
            progressBar.tick()
        })
        await Promise.allSettled(deletePromises)
    }

    console.log("Finished deletes")

    progressBar = new ProgressBar(
        "--- Storing missing configs [:bar] :current/:total :elapseds\n",
        {
            total: hashesOfFilesToToUpsert.size,
        }
    )

    const errors = []

    // Chunk the inserts so that we don't need to keep all the full configs in memory
    for (const batch of chunk([...hashesOfFilesToToUpsert.entries()], 100)) {
        // Get the full configs for the batch
        const fullConfigs = await knexRaw<
            Pick<DbRawChartConfig, "id" | "full">
        >(trx, `select id, full from chart_configs where id in (?)`, [
            batch.map((entry) => entry[1].id),
        ])
        const fullConfigMap = new Map<string, string>(
            fullConfigs.map(({ id, full }) => [id, full])
        )

        // Upload the full configs to R2 in parallel
        const uploadPromises = batch.map(async ([key, val]) => {
            const id = val.id
            const fullMd5 = val.fullMd5
            const full = fullConfigMap.get(id)
            if (full === undefined) {
                return Promise.reject(
                    new Error(`Full config not found for id ${id}`)
                )
            }
            const putObjectCommandInput: PutObjectCommandInput = {
                Bucket: GRAPHER_CONFIG_R2_BUCKET,
                Key: key,
                Body: full,
                ContentMD5: fullMd5,
                ContentType: "application/json",
            }
            if (!dryRun)
                await s3Client.send(new PutObjectCommand(putObjectCommandInput))
            else console.log("Would have upserted", key)
            progressBar.tick()
            return
        })
        const promiseResults = await Promise.allSettled(uploadPromises)
        const batchErrors = promiseResults
            .filter((result) => result.status === "rejected")
            .map((result) => result.reason)
        errors.push(...batchErrors)
    }

    console.log("Finished upserts")
    if (errors.length > 0) {
        console.error(`${errors.length} Errors during upserts`)
        for (const error of errors) {
            console.error(error)
        }
    }
}

async function main(parsedArgs: parseArgs.ParsedArgs, dryRun: boolean) {
    if (
        GRAPHER_CONFIG_R2_BUCKET === undefined ||
        GRAPHER_CONFIG_R2_BUCKET_PATH === undefined
    ) {
        console.info("R2 bucket not configured, exiting")
        return
    }

    const s3Client = new S3Client({
        endpoint: R2_ENDPOINT,
        forcePathStyle: false,
        region: R2_REGION,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    const hashesOfFilesToToUpsertBySlug = new Map<string, HashAndId>()
    const hashesOfFilesToToUpsertByUuid = new Map<string, HashAndId>()
    const pathPrefixBySlug = excludeUndefined([
        GRAPHER_CONFIG_R2_BUCKET_PATH,
        R2GrapherConfigDirectory.publishedGrapherBySlug,
    ]).join("/")

    const pathPrefixByUuid = excludeUndefined([
        GRAPHER_CONFIG_R2_BUCKET_PATH,
        R2GrapherConfigDirectory.byUUID,
    ]).join("/")

    await knexReadonlyTransaction(async (trx) => {
        // Sync charts published by slug
        const slugsAndHashesFromDb = await knexRaw<
            Pick<DbRawChartConfig, "slug" | "fullMd5" | "id">
        >(
            trx,
            `select slug, fullMd5, id
             from chart_configs
             where slug is not null
             and full ->> '$.isPublished' = "true"`
        )

        slugsAndHashesFromDb.forEach((row) => {
            hashesOfFilesToToUpsertBySlug.set(
                `${pathPrefixBySlug}/${row.slug}.json`,
                {
                    fullMd5: row.fullMd5,
                    id: row.id,
                }
            )
        })

        await syncWithR2(
            s3Client,
            pathPrefixBySlug,
            hashesOfFilesToToUpsertBySlug,
            trx,
            dryRun
        )

        // Sync charts by UUID
        const slugsAndHashesFromDbByUuid = await knexRaw<
            Pick<DbRawChartConfig, "fullMd5" | "id">
        >(trx, `select fullMd5, id from chart_configs`)

        slugsAndHashesFromDbByUuid.forEach((row) => {
            hashesOfFilesToToUpsertByUuid.set(
                `${pathPrefixByUuid}/${row.id}.json`,
                {
                    fullMd5: row.fullMd5,
                    id: row.id,
                }
            )
        })

        await syncWithR2(
            s3Client,
            pathPrefixByUuid,
            hashesOfFilesToToUpsertByUuid,
            trx,
            dryRun
        )
    })
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(
        `syncGraphersToR2.js - sync grapher configs from the chart_configs table to R2

--dry-run: Don't make any actual changes to R2`
    )
} else {
    main(parsedArgs, parsedArgs["dry-run"])
}
