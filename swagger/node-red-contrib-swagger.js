/*
 * Copyright (c) 2014. Knowledge Media Institute - The Open University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * NodeRed node with support for generic invocation of Web APIs based on Swagger
 *
 * @author <a href="mailto:carlos.pedrinaci@open.ac.uk">Carlos Pedrinaci</a> (KMi - The Open University)
 */

module.exports = function(RED) {

    "use strict";

    function SwaggerCredentialsNode(n) {
        RED.nodes.createNode(this,n);
    }

    RED.nodes.registerType("swagger credentials",SwaggerCredentialsNode,{
        credentials: {
            authType: {type: "text"},
            user: {type:"text"},
            password: {type: "password"}
        }
    });


    // The main node definition - most things happen in here
    function SwaggerApiNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);
    
        // Store local copies of the node configuration (as defined in the .html)
        this.api = n.api;
        this.resource = n.resource;
        this.method = n.method;

        // Request content type. By default the engine will fall back to "application/json"
        this.intype = n.intype;
        // Response content type. By default the engine will fall back to "application/json"
        this.outtype = n.outtype;

        // Authentication credentials
        this.authconfig = n.authconfig;
        this.authentication = RED.nodes.getNode(this.authconfig);

        var node = this;
        var swagger = require('swagger-client');

        if (node.api != undefined && (node.swaggerClient == undefined || node.swaggerClient.url !== node.api)) {

            node.swaggerClient = new swagger.SwaggerApi({
                url: node.api,
//                    useJQuery: true,
                success: function () {
                    if (this.ready) {
                        node.log("Client created for: " + node.api);
                        // We should setup authentication here once and for all but authentication is
                        // handled as a global variable accross all swagger clients by swagger.js for now
                        // TODO: Fix this when swagger.js updates authentication handling
                    }
                },
                // define failure function
                failure: function () {
                    node.warn("Unable to create client for: " + node.api);
                }
            });
        }

        // Handle the response
        var responseFunction = function(response) {
            var resp;
            if (response == undefined ) {
                // In principle this branch should not be executed but in case
                node.warn("API successfully invoked but no response obtained.");
            } else {
                // Check response content type and handle accordingly
                // If unspecified we assume json
                if (node.outtype != undefined && node.outtype !== "" && node.outtype !== "application/json") {
                    // Not JSON, treat as a string
                    resp = {status: response.status, payload: response.data.toString()};
                } else {
                    try {
                        resp = {status: response.status, payload: JSON.parse(response.data)};
                    } catch(error) {
                        node.warn("Ignoring output as it was expected to be JSON and was not: " +  response.data);
                        return;
                    }
                }
            }
            node.send(resp);
        };

        var errorFunction = function(response) {
            var resp;
            if (response == undefined ) {
                // In principle this branch should not be executed but in case
                node.error("Error invoking API. No response obtained.");
            } else {
                if (response.hasOwnProperty("data") && response.hasOwnProperty("status")) {
                    node.warn("API invocation returned an error. Status: " + response.status + " Message: " + response.data.toString());
                    resp = {status: response.status, payload: response.data.toString()};
                }
            }
            node.send(resp);
        };

        var requiredAuthentication = function(swaggerClient, resource, method) {
            var scheme;
            if (swaggerClient != undefined && swaggerClient.ready === true) {
                // Auth schemes definitions
                var authSchemes = swaggerClient.apis[resource].api.authSchemes;
                if (authSchemes != null) {
                    var authSchemesKeys = Object.keys(authSchemes);
                    if (authSchemesKeys.length > 0) {
                        // Authentications schemes are defined

                        // Find out the scheme needed. Check the operation and then the resource.
                        // Operations override authentication from resources
                        // We assume only the first one applies

                        var opAuths = swaggerClient.apis[resource].operations[method].authorizations;
                        if (opAuths != undefined) {
                            var opAuthSchemesKeys = Object.keys(opAuths);
                            if (opAuthSchemesKeys.length > 0) {
                                // The operation specifies its authentication
                                scheme = authSchemes[opAuthSchemesKeys[0]];
                                scheme.name = opAuthSchemesKeys[0];
                            }
                        } else {
                            // Get the resources authentication requirements instead
                            var resAuths = swaggerClient.apis[resource].api.authorizations;
                            var authSchemesKeys = Object.keys(resAuths);
                            if (authSchemesKeys.length > 0) {
                                // The resource specifies its authentication
                                scheme = authSchemes[resAuths[0]];
                                scheme.name = resAuths[0];
                            }
                        }
                    }
                }
            }
            return scheme;
        }

        var setupAuthorization = function() {
            // Figure out if we need authentication and if necessary deal with it
            // The current implementation of Swagger.js has authorizations as a global variable.
            // Clean it and set it up at every invocation ...
            // TODO: Fix it if swagger.js provides a better approach to this
            var auth;
            for (auth in swagger.authorizations.authz) {
                swagger.authorizations.remove(auth);
            }

            var scheme = requiredAuthentication(node.swaggerClient, node.resource, node.method);
            if (scheme != undefined) {
                // ensure we have the same kind of credentials necessary
                var credentials = node.authentication.credentials;

                if (credentials != undefined && scheme != undefined && credentials.authType === scheme.type) {
                    // Add the credentials to the client
                    switch(scheme.type) {
                        case 'apiKey':
                            swagger.authorizations.add(scheme.name, new swagger.ApiKeyAuthorization(scheme.keyname, credentials.password, scheme.passAs));
                            break;

                        case 'basicAuth':
                            // The first parameter for the password authorization is unclear to me (and not used by node.swagger-client?)
                            swagger.authorizations.add(scheme.name, new swagger.PasswordAuthorization(scheme.type, credentials.user, credentials.password));
                            break;

                        //TODO: handle oauth2
                    }
                } else if (credentials != undefined && credentials.authType !== scheme.type) {
                    // We can't provide the credentials. Warn?
                    node.warn("This API requires authentication of type " + scheme.type + " . No appropriate credentials have been provided. Please reconfigure the node.");
                }
            }
        }


        this.on("input", function(msg) {

            if (node.swaggerClient != undefined && node.swaggerClient.ready === true) {
                // Deal with authorisation if necessary
                setupAuthorization();
                // Set the options
                var opts = {};
                // Note if unspecified swagger.js assumes json in most cases
                if (node.intype != undefined && node.intype != "") {
                    opts["requestContentType"] = node.intype;
                }
                // Note if unspecified swagger.js assumes json in most cases
                if (node.outtype != undefined && node.outtype != "") {
                    opts["responseContentType"] = node.outtype;
                }

                var params;
                // Check the type of the input
                if (msg.payload == undefined || msg.payload === '' ) {
                    params = {};
                } else {
                    if (typeof msg.payload === "string") {
                        // It's a string: parse it as JSON
                        try {
                            params = JSON.parse(msg.payload);
                        } catch(error) {
                            node.warn("The input should be a JSON object. Ignoring");
                            return;
                        }
                    } else {
                        // Already an object
                        params = msg.payload;
                    }
                }

                // Use "do" until issue #101 on swagger.js is sorted
//                node.swaggerClient['apis'][node.resource][node.method](params, responseFunction, errorFunction);
//                node.swaggerClient['apis'][node.resource][node.method](params, opts, responseFunction, errorFunction);
                node.swaggerClient['apis'][node.resource]['operations'][node.method]["do"](params, opts, responseFunction, errorFunction);


            } else {
                node.warn("API client not ready. Is the Web API accessible?");
            }
        });
    
        this.on("close", function() {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: this.client.disconnect();
        });
    }
    
    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("swagger api",SwaggerApiNode);

    // Expose internal javascript
    RED.httpAdmin.get('/swagger/:file', function(req, res){

        var fs = require("fs");

        if (req.params.file.indexOf("..") > -1) {
            res.send("<html><head></head><body>Unable to access the file requested.</body></html>");
        } else {
            fs.readFile(require('path').resolve(__dirname, "../node_modules/swagger-client/lib/" + req.params.file),function(err,data) {
                if (err) {
                    node.log(err);
                    res.send("<html><head></head><body>Error reading the file: <br />" + err + "</body></html>");
                } else {
                    res.set('Content-Type', 'text/javascript').send(data);
                }
            });
        }
    });
    
}
