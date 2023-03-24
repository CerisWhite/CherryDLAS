import path from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { ServerConfig } from "./serverConfig";
import { RequestListener } from "http";
import { fileURLToPath } from "url";

export function createListener(config: ServerConfig): RequestListener {
	return async (req, res) => {
		const URLPath = req.url.split("/");

		if (URLPath.includes("..")) {
			res.writeHead(404);
			res.end("404: File not found");
			return;
		}
		if (URLPath[1] == "test") {
			console.log("Connected!");
			res.end("<p>Connected!</p>");
		} else if (URLPath[1] == "dl") {
			console.log(URLPath[5], URLPath[6]);
			for (let i in config.assetpaths) {
				// "say 'no' to directory traversal attacks" - some guy i'm in a discord server with, probably
				let FilePath = "";
				try {
					if (URLPath[2] === "manifests") {
						FilePath = path.join(
							config.assetpaths[i],
							URLPath[4],
							URLPath[5]
						);
					} else {
						FilePath = path.join(
							config.assetpaths[i],
							URLPath[4],
							URLPath[5]
						);
					}

					if (!existsSync(FilePath)) {
						continue;
					}

					const data = await readFile(FilePath);

					res.writeHead(200);
					res.end(data);
					return;
				} catch (err) {
					console.error("An error has occurred.", err);
					res.writeHead(500);
					res.end();
					return;
				}
			}

			console.log("Could not find file", URLPath[5]);
			res.writeHead(404);
			res.end("Not found");
		}
	};
}
