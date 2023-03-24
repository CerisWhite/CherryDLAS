import { cwd, exit } from "process";
import * as http from "http";
import * as https from "https";
import path from "path";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { ServerOptions } from "https";
import { isServerConfig, ServerConfig } from "./serverConfig.js";
import { createListener } from "./listener.js";
import { AssetVer } from "./assertVer.js";

const OrchisAssetURL = "https://orchis.cherrymint.live/dl";
const BasePath = path.join(cwd(), "orchis");

if (!existsSync(BasePath)) {
	await mkdir(BasePath);
}

let ActiveDownloads = 0;

if (!existsSync("./config.json")) {
	const defaultConfig: ServerConfig = {
		ssl: false,
		key: "",
		cert: "",
		ca: "",
		port: 3000,
		assetpaths: [process.cwd()],
	};

	await writeFile("./config.json", JSON.stringify(defaultConfig, null, 4));
}

const CertConf: ServerOptions = {};
const Configuration: any = JSON.parse(await readFile("./config.json", "utf8"));

if (!isServerConfig(Configuration)) {
	console.error("Server configuration had invalid or missing properties.");
	exit(1);
}

Configuration.assetpaths.unshift(BasePath);

if (Configuration.ssl && Configuration.key && Configuration.cert) {
	CertConf.key = await readFile(Configuration.key, "utf8");
	CertConf.cert = await readFile(Configuration.cert, "utf8");

	https
		.createServer(CertConf, createListener(Configuration))
		.listen(Configuration.port);
} else {
	http.createServer(createListener(Configuration)).listen(Configuration.port);
}

async function OrchisAssetVer(): Promise<AssetVer> {
	return new Promise((resolve, reject) => {
		let FinalData = "";
		https
			.get("https://orchis.cherrymint.live/assetver", (Response) => {
				Response.on("data", (chunk) => {
					FinalData += chunk;
				});
				Response.on("end", () => {
					resolve(JSON.parse(FinalData));
				});
			})
			.on("error", (err) => {
				reject("Error: " + err.message);
			});
	});
}
async function DownloadOrchisManifest(ManifestHash) {
	const ManifestPath = path.join(BasePath, ManifestHash);
	const ManifestBaseURL =
		OrchisAssetURL + "/manifests/universe/" + ManifestHash;

	await Promise.all([
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.manifest",
			path.join(ManifestPath, "assetbundle.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.en_us.manifest",
			path.join(ManifestPath, "assetbundle.en_us.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.zh_cn.manifest",
			path.join(ManifestPath, "assetbundle.zh_cn.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.zh_tw.manifest",
			path.join(ManifestPath, "assetbundle.zh_tw.manifest")
		),
	]);
}
async function DownloadAsset(TargetURL, TargetPath) {
	while (ActiveDownloads >= 5) {
		await new Promise((resolve) => setTimeout(resolve, 10000));
	}
	ActiveDownloads += 1;
	return new Promise((resolve, reject) => {
		console.log("Downloading " + TargetURL);
		https
			.get(TargetURL, (Response) => {
				const WriteOut = createWriteStream(TargetPath).on(
					"finish",
					() => {
						ActiveDownloads -= 1;
						resolve({});
					}
				);
				Response.pipe(WriteOut);
			})
			.on("error", (err) => {
				ActiveDownloads -= 1;
				reject("Error: " + err.message);
			});
	});
}
async function OrchisHeartbeat() {
	while (true) {
		while (ActiveDownloads >= 5) {
			await new Promise((resolve) => setTimeout(resolve, 10000));
		}
		const VersionData: AssetVer = await OrchisAssetVer();
		if (!existsSync(path.join(BasePath, VersionData.iOS_Manifest))) {
			await mkdir(path.join(BasePath, VersionData.iOS_Manifest));
			await DownloadOrchisManifest(VersionData.iOS_Manifest);
		}

		if (!existsSync(path.join(BasePath, VersionData.Android_Manifest))) {
			await mkdir(path.join(BasePath, VersionData.Android_Manifest));
			await DownloadOrchisManifest(VersionData.Android_Manifest);
		}

		for (let entry in VersionData.iOS_FileList) {
			const FilePath = path.join(
				BasePath,
				VersionData.iOS_FileList[entry].slice(0, 2),
				VersionData.iOS_FileList[entry]
			);
			if (!existsSync(FilePath)) {
				if (
					!existsSync(
						path.join(
							BasePath,
							VersionData.iOS_FileList[entry].slice(0, 2)
						)
					)
				) {
					await mkdir(
						path.join(
							BasePath,
							VersionData.iOS_FileList[entry].slice(0, 2)
						)
					);
				}
				const AssetURL =
					OrchisAssetURL +
					"/assetbundles/iOS/" +
					VersionData.iOS_FileList[entry].slice(0, 2) +
					"/" +
					VersionData.iOS_FileList[entry];

				await DownloadAsset(AssetURL, FilePath);
			}
		}
		for (let entry in VersionData.Android_FileList) {
			const FilePath = path.join(
				BasePath,
				VersionData.Android_FileList[entry].slice(0, 2),
				VersionData.Android_FileList[entry]
			);
			if (!existsSync(FilePath)) {
				if (
					!existsSync(
						path.join(
							BasePath,
							VersionData.Android_FileList[entry].slice(0, 2)
						)
					)
				) {
					await mkdir(
						path.join(
							BasePath,
							VersionData.Android_FileList[entry].slice(0, 2)
						)
					);
				}
				const AssetURL =
					OrchisAssetURL +
					"/assetbundles/Android/" +
					VersionData.Android_FileList[entry].slice(0, 2) +
					"/" +
					VersionData.Android_FileList[entry];

				await DownloadAsset(AssetURL, FilePath);
			}
		}

		await new Promise((resolve) => setTimeout(resolve, 1800000));
	}
}

console.log("Fileserver started.");

if (!existsSync(path.join(BasePath, "b1HyoeTFegeTexC0"))) {
	const ManifestPath = path.join(BasePath, "b1HyoeTFegeTexC0");
	const ManifestBaseURL =
		OrchisAssetURL + "/manifests/universe/b1HyoeTFegeTexC0";
	await mkdir(ManifestPath);

	await Promise.all([
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.manifest",
			path.join(ManifestPath, "assetbundle.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.en_us.manifest",
			path.join(ManifestPath, "assetbundle.en_us.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.en_eu.manifest",
			path.join(ManifestPath, "assetbundle.en_eu.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.zh_cn.manifest",
			path.join(ManifestPath, "assetbundle.zh_cn.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.zh_tw.manifest",
			path.join(ManifestPath, "assetbundle.zh_tw.manifest")
		),
	]);
}

if (!existsSync(path.join(BasePath, "y2XM6giU6zz56wCm"))) {
	const ManifestPath = path.join(BasePath, "y2XM6giU6zz56wCm");
	const ManifestBaseURL =
		OrchisAssetURL + "/manifests/universe/y2XM6giU6zz56wCm";
	mkdirSync(ManifestPath);

	await Promise.all([
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.manifest",
			path.join(ManifestPath, "assetbundle.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.en_us.manifest",
			path.join(ManifestPath, "assetbundle.en_us.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.en_eu.manifest",
			path.join(ManifestPath, "assetbundle.en_eu.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.zh_cn.manifest",
			path.join(ManifestPath, "assetbundle.zh_cn.manifest")
		),
		DownloadAsset(
			ManifestBaseURL + "/assetbundle.zh_tw.manifest",
			path.join(ManifestPath, "assetbundle.zh_tw.manifest")
		),
	]);
}

await OrchisHeartbeat();
