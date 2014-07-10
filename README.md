# Generic API Client for NodeRed

This is a node for [NodeRed](http://nodered.org) a tool for easily wiring together hardware devices, APIs and online services. This node provides a generic client for Web APIs by using [Wordnik's Swagger javascript client](https://www.npmjs.org/package/swagger-client). All that is required for you to automatically be able to invoke a given API is to have at your disposal the corresponding [swagger](http://swagger.wordnik.com) description. Check out [Swagger-Spec](https://github.com/wordnik/swagger-spec) for additional information about the Swagger project, including additional libraries with support for other languages and more.

## What's Swagger?

Taken from Swagger's own documentation:

"The goal of Swagger™ is to define a standard, language-agnostic interface to REST APIs which allows both humans and computers to discover and understand the capabilities of the service without access to source code, documentation, or through network traffic inspection. When properly defined via Swagger, a consumer can understand and interact with the remote service with a minimal amount of implementation logic. Similar to what interfaces have done for lower-level programming, Swagger removes the guesswork in calling the service."

## How to Install

In order to use this node you, indeed, need to have a working copy of NodeRed. The current version of the code has been tested with versions 0.78+.
For NodeRed to pick up the node, you need either to include it within NodeRed, e.g., `{NodeRed Folder}/nodes/node-red-nodes`, or point to it from NodeRed `settings.js` file.

This node relies on node.js client for swagger [swagger-client](https://www.npmjs.org/package/swagger-client)

Install swagger-client:

```
npm install swagger-client
```

Until we sort things out there is an additional requirement for this node to work. 
You need to download `swagger.js` and `shred.bundle.js` into `{NodeRed Folder}/public/swagger`. 
You can find both files at `https://github.com/wordnik/swagger-js` in the `lib` folder. This is simply necessary for the Web browser to be able to automatically parse API descriptions and provide an adaptive form when creating new nodes. 

## Testing the Node

If you want to test your node you may go ahead and use existing swagger descriptions available online.
For example you may want to use the prototypical example `http://petstore.swagger.wordnik.com/api/api-docs`.  

## Status

The node is at a rather early stage but is already usable. Currently the node provides support for invocation for those APIs that do not require authentication. We shall be adding this functionality soon. Support for choosing the request and response content types is on the way, though not finalised.

License
-------

Copyright 2014 Knowledge Media Institute - The Open University.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
[apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.