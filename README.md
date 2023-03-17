# CherryDLAS
Cherry-Dragalia Lost Asset Server

A NodeJS fileserver made for use with Orchis.

This will automatically download manifests and updated files from Orchis directly to the `orchis` folder in the same directory as the script.

Additionally, a `config.json` is available to define your normal asset paths, and define other settings as well.
For example, if you set `"assetpaths": [ "/home/ceris/Documents/DLAssets" ]`,
and make the request `https://example.io/dl/assetbundles/iOS/OP/OP30XXY`,
it will search for the file `/home/ceris/Documents/DLAssets/OP/OP30XXY`.
