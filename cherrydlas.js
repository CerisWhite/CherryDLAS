const fs = require('fs');
const path = require('path');
const process = require('process');
const sslcom = require('https');
let http = require('http');

const OrchisAssetURL = "https://orchis.cherrymint.live/dl"
const BasePath = path.join(process.cwd(), "orchis");
if (!fs.existsSync(BasePath)) {
	fs.mkdirSync(BasePath);
}
let ActiveDownloads = 0;

let Configuration = {};
let CertConf = {};
let ServerPort = 3000;
let AssetPaths = [ process.cwd(), BasePath ];
if (fs.existsSync('./config.json')) {
	Configuration = JSON.parse(fs.readFileSync('./config.json'));
	if (Configuration['ssl'] === true) {
		http = require('https'); 
		CertConf = {
			key: fs.readFileSync(Configuration['key']),
			cert: fs.readFileSync(Configuration['cert']),
		}
		ServerPort = Configuration['port'];
	}
	else { ServerPort = Configuration['port']; }
	if (Configuration['assetpaths'] !== undefined) {
		AssetPaths = Configuration['assetpaths'];
		AssetPaths.unshift(BasePath);
	}
}


else {
	fs.writeFileSync('./config.json', JSON.stringify({
		"ssl": false,
		"key": "./cert/privkey.pem",
		"cert": "./cert/cert.pem",
		"port": 3000,
		"assetpaths": [
			process.cwd()
		]
	}, null, 4));
}

http.createServer(CertConf, (req, res) => {
	const URLPath = req.url.split("/");
	if (URLPath.includes("..")) { res.writeHead(404); res.end('404: File not found'); return; }
	for (let i in AssetPaths) {
		// "say 'no' to directory traversal attacks" - some guy i'm in a discord server with, probably
		let FilePath = "";
		if (URLPath[2] == "manifests") { FilePath = path.join(AssetPaths[i], URLPath[4], URLPath[5]); }
		else { FilePath = path.join(AssetPaths[i], URLPath[5], URLPath[6]); }
		if (!fs.existsSync(FilePath)) { continue; }
		fs.readFile(FilePath, (err, data) => {
			res.writeHead(200);
			res.end(data);
			return;
		});
	}
}).listen(ServerPort);

async function OrchisAssetVer() {
	return new Promise((resolve, reject) => {
		let FinalData = "";
		sslcom.get("https://orchis.cherrymint.live/assetver", (Response) => {
			Response.on('data', (chunk) => {
				FinalData += chunk;
			});
			Response.on('end', () => {
				resolve(JSON.parse(FinalData));
			});
		}).on('error', (err) => {
			reject("Error: " + err.message);
		});
	});
}
async function DownloadManifest(ManifestHash, Platform) {
	const ManifestPath = path.join(BasePath, ManifestHash);
	const ManifestBaseURL = OrchisAssetURL + "/manifests/" + Platform + "/" + ManifestHash;
	DownloadAsset(ManifestBaseURL + "/assetbundle.manifest", path.join(ManifestPath, "assetbundle.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.en_us.manifest", path.join(ManifestPath, "assetbundle.en_us.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_cn.manifest", path.join(ManifestPath, "assetbundle.zh_cn.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_tw.manifest", path.join(ManifestPath, "assetbundle.zh_tw.manifest"));
}
async function DownloadAsset(TargetURL, TargetPath) {
	while (ActiveDownloads >= 4) { await new Promise(resolve => setTimeout(resolve, 18000)); }
	ActiveDownloads += 1;
	return new Promise((resolve, reject) => {
		console.log("Downloading " + TargetURL);
		sslcom.get(TargetURL, (Response) => {
			let FinalData = "";
			const WriteOut = fs.createWriteStream(TargetPath).on('finish', () => {
				ActiveDownloads -= 1;
				resolve({});
			});
			Response.pipe(WriteOut);
		}).on('error', (err) => {
			ActiveDownloads -= 1;
			reject("Error: " + err.message);
		});
	});
}
async function OrchisHeartbeat() {
	while (true) {
		const VersionData = await OrchisAssetVer();
		if (!fs.existsSync(path.join(BasePath, VersionData['iOS_Manifest']))) {
			fs.mkdirSync(path.join(BasePath, VersionData['iOS_Manifest']));
			await DownloadManifest(VersionData['iOS_Manifest'], "iOS");
		}
		if (!fs.existsSync(path.join(BasePath, VersionData['Android_Manifest']))) {
			fs.mkdirSync(path.join(BasePath, VersionData['Android_Manifest']));
			await DownloadManifest(VersionData['Android_Manifest'], "Android");
		}
		for (let entry in VersionData['iOS_FileList']) {
			const FilePath = path.join(BasePath, VersionData['iOS_FileList'][entry].slice(0, 2), VersionData['iOS_FileList'][entry]);
			if (!fs.existsSync(FilePath)) {
				if (!fs.existsSync(path.join(BasePath, VersionData['iOS_FileList'][entry].slice(0, 2)))) { 
					fs.mkdirSync(path.join(BasePath, VersionData['iOS_FileList'][entry].slice(0, 2))); 
				}
				const AssetURL = OrchisAssetURL + "/assetbundles/iOS/" + VersionData['iOS_FileList'][entry].slice(0, 2) + "/" + VersionData['iOS_FileList'][entry];
				DownloadAsset(AssetURL, FilePath);
			}
		}
		for (let entry in VersionData['Android_FileList']) {
			const FilePath = path.join(BasePath, VersionData['Android_FileList'][entry].slice(0, 2), VersionData['Android_FileList'][entry]);
			if (!fs.existsSync(FilePath)) {
				if (!fs.existsSync(path.join(BasePath, VersionData['Android_FileList'][entry].slice(0, 2)))) { 
					fs.mkdirSync(path.join(BasePath, VersionData['Android_FileList'][entry].slice(0, 2))); 
				}
				const AssetURL = OrchisAssetURL + "/assetbundles/Android/" + VersionData['Android_FileList'][entry].slice(0, 2) + "/" + VersionData['Android_FileList'][entry];
				DownloadAsset(AssetURL, FilePath);
			}
		}
		await new Promise(resolve => setTimeout(resolve, 1800000));
	}
}

console.log('Fileserver started.');
OrchisHeartbeat();
