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
    var fs = require("fs");
    var path = require('path');
    var querystring = require('querystring');

    RED.httpAdmin.get('/swagger-configuration/:id',function(req,res) {
        var credentials = RED.nodes.getCredentials(req.params.id);

        if (credentials) {
            res.send(JSON.stringify({authType: credentials.authType, user:credentials.user,password:(credentials.password&&credentials.password!=="")}));
        } else {
            res.send(JSON.stringify({}));
        }
    });

    RED.httpAdmin.delete('/swagger-configuration/:id',function(req,res) {
        RED.nodes.deleteCredentials(req.params.id);
        res.send(200);
    });

    RED.httpAdmin.post('/swagger-configuration/:id',function(req,res) {
        var body = "";
        req.on('data', function(chunk) {
            body+=chunk;
        });
        req.on('end', function(){
            var newCreds = querystring.parse(body);
            var credentials = RED.nodes.getCredentials(req.params.id)||{};
            if (newCreds.authType == null || newCreds.authType === "") {
                delete credentials.authType;
            } else {
                credentials.authType = newCreds.authType;
            }
            if (newCreds.user == null || newCreds.user === "") {
                delete credentials.user;
            } else {
                credentials.user = newCreds.user;
            }
            if (newCreds.password === "") {
                delete credentials.password;
            } else {
                credentials.password = newCreds.password||credentials.password;
            }
            RED.nodes.addCredentials(req.params.id,credentials);
            res.send(200);
        });
    });

    function SwaggerConfigurationNode(n) {
        RED.nodes.createNode(this,n);

        this.apiUrl = n.apiUrl;
        this.name = n.name;

        var credentials = {};
        if (n.user) {
            credentials.authType = n.authType;
            credentials.user = n.user;
            credentials.password = n.pass;
            RED.nodes.addCredentials(n.id,credentials);
            this.authType = n.authType;
            this.user = n.user;
            this.password = n.pass;
        } else {
            credentials = RED.nodes.getCredentials(n.id);
            if (credentials) {
                this.authType = credentials.authType;
                this.user = credentials.user;
                this.password = credentials.password;
            }
        }
    }

    RED.nodes.registerType("swagger configuration",SwaggerConfigurationNode);

    // The main node definition - most things happen in here
    function SwaggerClientNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        // Store local copies of the node configuration (as defined in the .html)
        this.apiConfig = RED.nodes.getNode(n.apiConfig);
        if (this.apiConfig != undefined) {
            this.apiUrl = this.apiConfig.apiUrl;
        }

        this.resource = n.resource;
        this.method = n.method;

        // Request content type. By default the engine will fall back to "application/json"
        this.inType = n.inType;
        // Response content type. By default the engine will fall back to "application/json"
        this.outType = n.outType;

        // Authentication credentials
        this.authConfig = n.authConfig;
        this.authentication = RED.nodes.getNode(this.authConfig);

        var node = this;
        var swagger = require('swagger-client');

        // Handling of errors
        var domain = require('domain');
        var d = domain.create();
        d.on('error', function(err) {
            console.log(err);
        });

        if (node.apiUrl != undefined && (node.swaggerClient == undefined || node.swaggerClient.url !== node.apiUrl)) {

            // Use a domain to catch inner exceptions
            d.run(function() {
                node.swaggerClient = new swagger.SwaggerApi({
                    url: node.apiUrl,
                    success: function () {
                        if (this.ready) {
                            node.log("Client created for: " + node.apiUrl);
                            // We should setup authentication here once and for all but authentication is
                            // handled as a global variable accross all swagger clients by swagger.js for now
                            // TODO: Fix this when swagger.js updates authentication handling
                        }
                    },
                    // define failure function
                    failure: function () {
                        node.warn("Unable to create client for: " + node.apiUrl);
                    }
                });
            });
        }

        // Handle the response
        var responseFunction = function(response) {
            var msg = {};

            if (response == undefined ) {
                // In principle this branch should not be executed but in case
                node.warn("API successfully invoked but no response obtained.");
            } else {
                if (response.hasOwnProperty("status")) {
                    msg.status = response.status;
                } else {
                    // Should not occur in principle
                    msg.status = 500;
                }

                if (response.hasOwnProperty("data")) {
                    // If the response is empty just pass it on
                    if (response.data.length === 0) {
                        msg.payload = {};
                    } else {
                        // Check response content type and handle accordingly
                        // If unspecified we assume json
                        if (node.outType != undefined && node.outType !== "" && node.outType !== "application/json") {
                            // Not JSON, treat as a string
                            msg.payload = response.data.toString();
                        } else {
                            // Parse the response
                            try {
                                msg.payload = JSON.parse(response.data);
                            } catch (error) {
                                node.warn("Ignoring output as it was expected to be JSON and was not: '" + response.data + "'");
                                return;
                            }
                        }
                    }
                } else {
                    msg.payload = {};
                }
            }
            node.send(msg);
        };

        var errorFunction = function(response) {
            var msg = {};
            if (response == undefined ) {
                // In principle this branch should not be executed but in case
                node.error("Error invoking API. No response obtained.");
            } else {
                if (response.hasOwnProperty("status")) {
                    msg.status = response.status;
                } else {
                    // Should not occur in principle
                    msg.status = 500;
                }

                if (response.hasOwnProperty("data")) {
                    msg.payload = response.data.toString();
                } else {
                    msg.payload = {};
                }

                node.warn("API invocation returned an error. Status: " + msg.status + " Message: " + msg.payload.toString());
            }

            node.send(msg);
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
                var authType = node.apiConfig.authType;
                var user = node.apiConfig.user;
                var password = node.apiConfig.password;

                if (authType != undefined && scheme != undefined && authType === scheme.type) {
                    // Add the credentials to the client
                    switch(scheme.type) {
                        case 'apiKey':
                            swagger.authorizations.add(scheme.name, new swagger.ApiKeyAuthorization(scheme.keyname, password, scheme.passAs));
                            break;

                        case 'basicAuth':
                            // The first parameter for the password authorization is unclear to me (and not used by node.swagger-client?)
                            swagger.authorizations.add(scheme.name, new swagger.PasswordAuthorization(scheme.type, user, password));
                            break;

                        //TODO: handle oauth2
                    }
                } else if (authType != undefined && authType !== scheme.type) {
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
                if (node.inType != undefined && node.inType != "") {
                    opts["requestContentType"] = node.inType;
                }
                // Note if unspecified swagger.js assumes json in most cases
                if (node.outType != undefined && node.outType != "") {
                    opts["responseContentType"] = node.outType;
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
    RED.nodes.registerType("swagger api",SwaggerClientNode);

// Expose internal javascript
    RED.httpAdmin.get('/swagger-js/:file', function(req, res){

        fs.readFile(path.resolve(__dirname, "../node_modules/swagger-client/lib/" + req.params.file),function(err,data) {
            if (err) {
                res.send("<html><head></head><body>Error reading the file: <br />" + req.params.file + "</body></html>");
            } else {
                res.set('Content-Type', 'text/javascript').send(data);
            }
        });
    });

    // Expose an index of local swagger descriptions
    var swaggerDescFolder = path.resolve(__dirname, "../swagger-descriptions");

    // Expose swagger descriptions available locally
    RED.httpAdmin.get('/swagger-descriptions*', function(req, res){

        // Special treatment for the root folder
        if (req.params[0] === "" || req.params[0] === "/") {
            fs.readdir(swaggerDescFolder, function(err, files) {
                if (err) {
                    res.send("<html><head></head><body>Error listing swagger descriptions.</body></html>");
                } else {
                    var dirs = files.filter(function(element) {
                        return fs.lstatSync(path.join(swaggerDescFolder, element)).isDirectory();
                    });
                    res.set('Content-Type', 'text/javascript').send(dirs);
                }
            });
        } else {
            // Obtain the actual file
            var resolvedFile = path.join(swaggerDescFolder, req.params[0]);
            // If top level folder, then return index.json, otherwise get what was requested
            fs.lstat(resolvedFile, function(err, stats) {
                if (err) {
                    res.send("<html><head></head><body>Error no such file or directory</body></html>");
                } else {
                    if (stats.isDirectory()) {
                        resolvedFile = path.join(resolvedFile, "index.json");
                    }

                    // Get the file and send it
                    fs.readFile(resolvedFile, function (err, data) {
                        if (err) {
                            res.send("<html><head></head><body>Unable to read file or directory</body></html>");
                        } else {
                            res.set('Content-Type', 'text/javascript').send(data);
                        }
                    });
                }
            });
        }
    });

}
