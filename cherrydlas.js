const fs = require('fs');
const path = require('path');
const process = require('process');
const sslcom = require('https');
let http = require('http');

const URLRegex = /\.\.|\\/g;
const OrchisAssetURL = "https://minty.sbs/dl";
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
	if (req.url.match(URLRegex)) { res.writeHead(404); res.end('404: File not found'); return; }
	const URLPath = req.url.split("/");
	if (URLPath[1] == "test") {
		console.log("Connected!");
		res.end("<p>Connected!</p>");
		return;
	}
	else if (URLPath[1] == "dl") {
		let Attempt = 1;
		for (let i in AssetPaths) {
			// "say 'no' to directory traversal attacks" - some guy i'm in a discord server with, probably
			let FilePath = "";
			try {
				if (URLPath[2] == "manifests") { FilePath = path.join(AssetPaths[i], URLPath[4], URLPath[5]); }
				else { FilePath = path.join(AssetPaths[i], URLPath[5], URLPath[6]); }
				
				if (!fs.existsSync(FilePath) && Attempt >= AssetPaths.length) {
					res.writeHead(404);
					res.end("<p>File not found</p>");
					return;
				}
				else if (!fs.existsSync(FilePath)) { Attempt += 1; continue; }
				const File = fs.readFileSync(FilePath);
				res.writeHead(200);
				res.end(File);
				return;
			} catch(err) {
				console.error("An error occurred while writing the response:", err);
				res.writeHead(500);
				res.end();
				return;
			}
		}
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
			console.error("Error fetching /assetver");
		});
	});
}
async function DownloadOrchisManifest(ManifestHash) {
	const ManifestPath = path.join(BasePath, ManifestHash);
	const ManifestBaseURL = OrchisAssetURL + "/manifests/universe/" + ManifestHash;
	DownloadAsset(ManifestBaseURL + "/assetbundle.manifest", path.join(ManifestPath, "assetbundle.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.en_us.manifest", path.join(ManifestPath, "assetbundle.en_us.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_cn.manifest", path.join(ManifestPath, "assetbundle.zh_cn.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_tw.manifest", path.join(ManifestPath, "assetbundle.zh_tw.manifest"));
}
async function DownloadAsset(TargetURL, TargetPath) {
	while (ActiveDownloads >= 5) { await new Promise(resolve => setTimeout(resolve, 10000)); }
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
			console.error("Error downloading asset " + TargetURL);
		});
	});
}
async function OrchisHeartbeat() {
	while (true) {
		while (ActiveDownloads >= 5) { await new Promise(resolve => setTimeout(resolve, 10000)); }
		const VersionData = await OrchisAssetVer();
		if (!fs.existsSync(path.join(BasePath, VersionData['iOS_Manifest']))) {
			fs.mkdirSync(path.join(BasePath, VersionData['iOS_Manifest']));
			await DownloadOrchisManifest(VersionData['iOS_Manifest']);
		}
		if (!fs.existsSync(path.join(BasePath, VersionData['Android_Manifest']))) {
			fs.mkdirSync(path.join(BasePath, VersionData['Android_Manifest']));
			await DownloadOrchisManifest(VersionData['Android_Manifest']);
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
if (!fs.existsSync(path.join(BasePath, "b1HyoeTFegeTexC0"))) {
	const ManifestPath = path.join(BasePath, "b1HyoeTFegeTexC0");
	const ManifestBaseURL = OrchisAssetURL + "/manifests/universe/b1HyoeTFegeTexC0";
	fs.mkdirSync(ManifestPath);
	DownloadAsset(ManifestBaseURL + "/assetbundle.manifest", path.join(ManifestPath, "assetbundle.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.en_us.manifest", path.join(ManifestPath, "assetbundle.en_us.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.en_eu.manifest", path.join(ManifestPath, "assetbundle.en_eu.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_cn.manifest", path.join(ManifestPath, "assetbundle.zh_cn.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_tw.manifest", path.join(ManifestPath, "assetbundle.zh_tw.manifest"));
}
if (!fs.existsSync(path.join(BasePath, "y2XM6giU6zz56wCm"))) {
	const ManifestPath = path.join(BasePath, "y2XM6giU6zz56wCm");
	const ManifestBaseURL = OrchisAssetURL + "/manifests/universe/y2XM6giU6zz56wCm";
	fs.mkdirSync(ManifestPath);
	DownloadAsset(ManifestBaseURL + "/assetbundle.manifest", path.join(ManifestPath, "assetbundle.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.en_us.manifest", path.join(ManifestPath, "assetbundle.en_us.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.en_eu.manifest", path.join(ManifestPath, "assetbundle.en_eu.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_cn.manifest", path.join(ManifestPath, "assetbundle.zh_cn.manifest"));
	DownloadAsset(ManifestBaseURL + "/assetbundle.zh_tw.manifest", path.join(ManifestPath, "assetbundle.zh_tw.manifest"));
}
OrchisHeartbeat();
