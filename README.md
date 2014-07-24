# Generic API Client for NodeRed

This is a node for [NodeRed](http://nodered.org) a tool for easily wiring together hardware devices, APIs and online services. This node provides a generic client for Web APIs by using [Wordnik's Swagger javascript client](https://www.npmjs.org/package/swagger-client). All that is required for you to automatically be able to invoke a given API is to have at your disposal the corresponding [swagger](http://swagger.wordnik.com) description. Check out [Swagger-Spec](https://github.com/wordnik/swagger-spec) for additional information about the Swagger project, including additional libraries with support for other languages and more.

## What's Swagger?

Taken from Swagger's own documentation:

"The goal of Swagger™ is to define a standard, language-agnostic interface to REST APIs which allows both humans and computers to discover and understand the capabilities of the service without access to source code, documentation, or through network traffic inspection. When properly defined via Swagger, a consumer can understand and interact with the remote service with a minimal amount of implementation logic. Similar to what interfaces have done for lower-level programming, Swagger removes the guesswork in calling the service."

## How to Install

Run the following command in the root directory of your Node-RED install

```
npm install node-red-contrib-swagger
```

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