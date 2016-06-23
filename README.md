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

or for a global installation
```
npm install -g node-red-contrib-swagger
```

## Using the Node

Once installed you may be able to invoke any Web API described with swagger straight away. The only thing that
you need is to create a swagger configuration by adding the URL of some existing swagger documentation. For instance
you can give a go to [Dweet.io](https://dweet.io)'s API by using the following URL `https://dweet.io/play/definition`.

Until we include advanced search support for existing swagger descriptions online (work in progress), we
 provide means for serving locally swagger descriptions. This can be used for loading your own manually
crafted descriptions or for reusing descriptions made by others.

We have a Github project where we already provide some descriptions ready to be grabbed and reused.
See [https://github.com/kmi/swagger-descriptions](https://github.com/kmi/swagger-descriptions)

Should you have your own swagger description ready to be used you just need make it available to NodeRed via
an HTTP Server with CORS support. The easiest route is to use the embedded server within the node to serve the descriptions.
Essentially, files within [NodeRed_HOME]node_modules/node-red-contrib-swagger/swagger-descriptions are all served locally
at [http://localhost:1880/swagger-descriptions](http://localhost:1880/swagger-descriptions).
See [swagger-descriptions project](https://github.com/kmi/swagger-descriptions) for further details.

## Status

The node is maturing although some issues exist and a couple of features are in the to-do list.
The latest version of the node is v0.4.0.

*Important:* Users that previously used v0.3.0 in their workflows will need to do recreate their swagger nodes
to use v0.4.0. This is unfortunately necessary to adapt to a a richer means for configuring nodes that will
help reuse all swagger APIs configured within the same workflow or  different workspaces.
We expect this change to be long-standing and therefore won't expect such a disruption in future updates.


### Features
Currently the node provides support for:
 - Parsing and invoking Swagger 1.0, 1.2 and 2.0 descriptions (aka OpenAPI specification)
 - Content negotiation both for Request and Response content types
 - Authentication via Basic HTTP Auth and API Key 
 - Invocation of APIs (except those with other non-supported authentication mechanisms).
 - Embedded swagger descriptions server included sitting at http://node.red.base.url/swagger-descriptions
 - Feedback information about the status of the remote API
 - More detailed dynamic documentation of the API being used by the node so as to better help users in
 figuring out what the request message should look like. Selecting the node should populate the info tab with detailed documentation

### Future Features
We shall be providing the following functionality soon:
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