export interface ServerConfig {
	ssl: boolean;
	key: string | undefined;
	cert: string | undefined;
	ca: string | undefined;
	port: number;
	assetpaths: string[];
}

export function isServerConfig(o: any): o is ServerConfig {
	return (
		o &&
		typeof o.ssl === "boolean" &&
		(!o.key || typeof o.key === "string") &&
		(!o.cert || typeof o.cert === "string") &&
		(!o.ca || typeof o.ca === "string") &&
		typeof o.port === "number" &&
		Array.isArray(o.assetpaths) &&
		o.assetpaths.every((x) => typeof x === "string")
	);
}
