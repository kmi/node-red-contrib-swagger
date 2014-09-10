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

The node is maturing although some issues exist and a couple of features are in the to-do list. 

### Features
Currently the node provides support for:
 - Parsing and invoking Swagger 1.0+ description
 - Content negotiation both for Request and Response content types
 - Authentication via Basic HTTP Auth and API Key 
 - Invocation of APIs (except those with other non-supported authentication mechanisms). 
 
### Issues
Currently the node presents a couple of known issues from the underlying libraries being used.
- This node makes indirectly use of Shred for handling http requests. Unfortunately this library seems to have a dependency issue with the Orion editing library which is used by the NodeRed's Function node to edit functions code. As a result the editing of Functions  may not work (i.e., the form will not pop up) when this node is also under use. The functionality of both function nodes and swagger nodes still is ensured but it is certainly inconvenient not being able edit functions. We are currently looking into this to figure out a way around it. 
- The parsing of Authentication details does not seem to be done correctly by the swagger-library and therefore authentication details specified at a resource level will not be adequately detected. We expect a solution will soon be implemented at the level of the [Swagger javascript client](https://github.com/wordnik/swagger-js) which would resolve the problem altogether.

### Future Features
We shall be providing the following functionality soon:
- More detailed dynamic documentation of the API being used by the node so as to better help users in figuring out what the request message should look like.
- Support for OAuth 2.0 authentication.

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