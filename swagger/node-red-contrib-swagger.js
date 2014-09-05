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

        if (node.swaggerClient == undefined || node.swaggerClient.url !== node.api) {

            node.swaggerClient = new swagger.SwaggerApi({
                url: node.api,
//                useJQuery: true,
                success: function() {
                    if (this.ready) {
                        node.log("Client created for: " + node.api);
                        // We should setup authentication here once and for all but authentication is
                        // handled as a global variable accross all swagger clients by swagger.js for now
                        // TODO: Fix this when swagger.js updates this
                    }
                },
                // define failure function
                failure: function() {
                    node.warn("Unable to create client for: " + node.api);
                }
            });
        }

        // This assumes a JSON result for now
        var responseFunction = function(response) {
            var resp;
            if (response == undefined ) {
                // In principle this branch should not be executed but in case
                node.warn("API successfully invoked but no response obtained.");
            } else {
                try {
                    resp = {status: response.status, payload: JSON.parse(response.data)};
                } catch (error) {
                    node.error(error.stack);
                    resp = {status: response.status, payload: response.data.toString()};
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
                try {
                    resp = {status: response.status, payload: response.data.toString()};
                } catch (error) {
                    console.error(error.stack);
                    resp = {status: response.status, payload: response.data.toString()};
                }
            }
            node.error(resp);
        };

        var setupAuthorization = function() {
            // Figure out if we need authentication and if necessary deal with it
            // The current implementation of Swagger.js has authorizations as a global variable.
            // Clean it and set it up at every invocation ...
            // TODO: Fix it if swagger.js provides a better approach to this

            for (auth in swagger.authorizations.authz) {
                swagger.authorizations.remove(auth);
            }

            // Auth schemes required for all operations within that api
            // node.swaggerClient.apis['apiName'].api.authSchemes

            // Can be overriden by the operation
            // node.swaggerClient.apis['apiName'].operations['operationName'].authorizations

            var authSchemes = node.swaggerClient.apis[node.resource].api.authSchemes;
            var authSchemesKeys = Object.keys(authSchemes);
            if (authSchemesKeys.length > 0) {
                // Authentication may be necessary for the API
                // Obtain the right scheme for the operation

                // By default assume the first authentication for the top level resource
                var schemeName = authSchemesKeys[0];

                var opAuthSchemesKeys;
                var opAuths = node.swaggerClient.apis[node.resource].operations[node.method].authorizations;
                if (opAuths != undefined) {
                    opAuthSchemesKeys = Object.keys(opAuths);
                    if (opAuthSchemesKeys.length > 0) {
                        // The operation specifies its authentication
                        schemeName = opAuthSchemesKeys[0];
                    }
                }

                // Get the actual scheme to use. We assume here that only one applies.
                var scheme = authSchemes[schemeName][0];

                // ensure we have the same kind of credentials necessary
                var credentials = node.authentication.credentials;

                if (credentials != undefined && scheme != undefined && credentials.authType === scheme.type) {
                    console.log("Adding auth");
                    // Add the credentials to the client
                    switch(scheme.type) {
                        case "apiKey":
                            console.log("Adding api key");
                            swagger.authorizations.add(node.id, new swagger.ApiKeyAuthorization(scheme.keyname, credentials.password, scheme.passAs));
                            break;

                        case "basicAuth":
                            // The first parameter for the password authorization is unclear to me (and not used by node.swagger-client?)
                            swagger.authorizations.add(node.id, new swagger.PasswordAuthorization(scheme.type, credentials.user, credentials.password));
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
            // Deal with authorisation if necessary
            setupAuthorization();

            if (node.swaggerClient.ready === true) {
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
                if (msg.payload === undefined || msg.payload === '' ) {
                    params = {};
                } else {
                    if (typeof msg.payload === "string") {
                        // It's a string: parse it as JSON
                        params = JSON.parse(msg.payload);
                    } else {
                        // Already an object
                        params = msg.payload;
                    }
                }

                // Disable until issue #101 on swagger.js is sorted
//                node.swaggerClient['apis'][node.resource][node.method](params, opts, responseFunction, errorFunction);
                node.swaggerClient['apis'][node.resource][node.method](params, responseFunction, errorFunction);
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
                    console.log(err);
                    res.send("<html><head></head><body>Error reading the file: <br />" + err + "</body></html>");
                } else {
                    res.set('Content-Type', 'text/javascript').send(data);
                }
            });
        }
    });
    
}
