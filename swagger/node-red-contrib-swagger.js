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
    var fs = require('fs');
    var path = require('path');
    var querystring = require('querystring');

    function SwaggerConfigurationNode(n) {
        RED.nodes.createNode(this,n);

        this.apiUrl = n.apiUrl;
        this.name = n.name;

        this.clientReady = false;
        this.creatingClient = false;
        this.queue = [];

        var node = this;

        var SwaggerClient = require('swagger-client');

        // Create a client and notify the callback (true=success)
        this.createClient = function (callback) {
            if (!this.clientReady) {
                if (!this.creatingClient) {
                    // Trigger the creation
                    node.creatingClient = true;
                    node.queue.push(callback);
                    // Handling of errors
                    var domain = require('domain');
                    var d = domain.create();
                    d.on('error', function (err) {
                        node.warn(err);
                    });

                    if (node.apiUrl != undefined) {
                        // Use a domain to catch inner exceptions
                        d.run(function () {
                            node.swaggerClient = new SwaggerClient({
                                url: node.apiUrl,
                                success: function () {
                                    if (this.ready) {
                                        node.creatingClient = false;
                                        node.clientReady = true;
                                        node.log("Client created for: " + node.apiUrl);
                                        for (var i = 0, size = node.queue.length; i < size; i++ ) {
                                            node.queue.pop()(true);
                                        }
                                        // We should setup authentication here once and for all but authentication is
                                        // handled as a global variable accross all swagger clients by swagger.js for now
                                        // TODO: Fix this when swagger.js updates authentication handling
                                    }
                                },
                                // define failure function
                                failure: function () {
                                    node.warn("Unable to create client for: " + node.apiUrl);
                                    for (var i = 0, size = node.queue.length; i < size; i++ ) {
                                        node.queue.pop()(false);
                                    }
                                }
                            });
                        });
                    }
                } else {
                    // Creation started, waiting for callback
                    node.queue.push(callback);
                }
            } else {
                // It's ready
                callback(true);
            }
        }

        // Invoke
        this.invoke = function (resource, method, params, opts, responseCallback, errorCallback) {
            if (node.clientReady) {
                // Deal with authorisation if necessary
                setupAuthentication(resource, method);
                node.swaggerClient['apis'][resource][method](params, opts, responseCallback, errorCallback);

            } else {
                // Client is not ready, send undefined
                errorCallback(undefined);
            }
        }

        function getRequiredAuth(resource, method) {
            var schemes = [];
            if (node.swaggerClient != undefined && node.swaggerClient.ready === true) {
                // Auth schemes definitions
                var secDefinitions = node.swaggerClient.securityDefinitions;
                if (secDefinitions != null && Object.keys(secDefinitions).length > 0) {
                    // Authentications schemes are defined
                    // Find out the scheme needed. Check the operation and then the API.
                    // Operations override authentication from the top level API
                    // All security schemes apply.
                    var auths = node.swaggerClient.security;

                    var opAuths = node.swaggerClient.apis[resource].operations[method].security;
                    if (opAuths != undefined) {
                        auths = opAuths;
                    }

                    if (auths != undefined) {
                        for (var i in auths) {
                            var scheme = secDefinitions[Object.keys(auths[i])[0]];
                            schemes.push(scheme);
                        }
                    }
                }
            }
            return schemes;
        }

        function setupAuthentication(resource, method) {
            // Figure out if we need authentication and if necessary deal with it

            var schemes = getRequiredAuth(resource, method);
            if (schemes != undefined) {
                if (schemes.length >= 2) {
                    // All schemes apply
                    // TODO: This isn't yet supported
                    node.warn("This API requires several authentication methods. This is not yet supported.");
                }

                var scheme = schemes[0];

                // ensure we have the same kind of credentials necessary
                var authType = node.credentials.authType;
                var user = node.credentials.user;
                var password = node.credentials.password;

                if (authType != undefined && scheme != undefined && authType === scheme.type) {
                    // Add the credentials to the client
                    switch(scheme.type) {
                        case 'apiKey':
                            node.swaggerClient.clientAuthorizations.add(scheme.name, new SwaggerClient.ApiKeyAuthorization(scheme.keyname, password, scheme.passAs));
                            break;

                        case 'basic':
                            // The first parameter for the password authorization is unclear to me (and not used by node.swagger-client?)
                            node.swaggerClient.clientAuthorizations.add(scheme.name, new SwaggerClient.PasswordAuthorization(scheme.type, user, password));
                            break;

                        //TODO: handle oauth2
                    }
                } else if (authType != undefined && authType !== scheme.type) {
                    // We can't provide the credentials. Warn?
                    node.warn("This API requires authentication of type " + scheme.type + " . No appropriate credentials have been provided. Please reconfigure the node.");
                }
            }
        }
    }

    RED.nodes.registerType("swagger configuration",SwaggerConfigurationNode, {
        credentials: {
            authType: {type: "text"},
            user: {type: "text"},
            password: {type: "password"}
        }
    });

    // The main node definition - most things happen in here
    function SwaggerClientNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        this.resource = n.resource;
        this.method = n.method;

        // Request content type. By default the engine will fall back to "application/json"
        this.inType = n.inType;
        // Response content type. By default the engine will fall back to "application/json"
        this.outType = n.outType;

        this.errorCount = 0;

        var node = this;

        function processResponse(response) {
            var msg = {};
            node.errorCount = 0;
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
        }

        function processError(response) {
            var msg = {};
            node.errorCount ++;
            if (response == undefined ) {
                // In principle this branch should not be executed but in case
                node.warn("Error invoking API. The client is not ready.");
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
        }

        // Store local copies of the node configuration (as defined in the .html)
        this.apiConfig = RED.nodes.getNode(n.apiConfig);
        if (this.apiConfig) {
            // handle status
            this.status({fill:"red",shape:"ring",text:"disconnected"});

            this.apiConfig.createClient(function(success) {
                if (success) {
                    node.status({fill: "green", shape: "ring", text: "client ready"});

                    // Handle input events
                    node.on("input", function (msg) {
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
                        if (msg.payload == undefined || msg.payload === '') {
                            params = {};
                        } else {
                            if (typeof msg.payload === "string") {
                                // It's a string: parse it as JSON
                                try {
                                    params = JSON.parse(msg.payload);
                                } catch (error) {
                                    node.warn("The input should be a JSON object. Ignoring");
                                    return;
                                }
                            } else {
                                // Already an object
                                params = msg.payload;
                            }
                        }

                        // invoke
                        node.apiConfig.invoke(node.resource, node.method, params, opts, processResponse, processError);

                        // Update status
                        if (node.errorCount === 0) {
                            node.status({fill:"green",shape:"dot",text:"online"});
                        } else if (node.errorCount <= 3) {
                            node.status({fill:"yellow",shape:"ring",text:"connection issues (" + node.errorCount + ")"});
                        } else {
                            node.status({fill:"yellow",shape:"dot",text:"API down"});
                        }
                    });

                    node.on("close", function () {
                        // Called when the node is shutdown - eg on redeploy.
                        // Allows ports to be closed, connections dropped etc.
                        // eg: this.client.disconnect();
                    });

                } else {
                    node.status({fill: "red", shape: "dot", text: "unavailable"});
                }
            });
        }
    }

// Register the node by name. This must be called before overriding any of the
// Node functions.
    RED.nodes.registerType("swagger api",SwaggerClientNode);

    // Expose internal javascript
    RED.httpAdmin.get('/swagger/client-adapter.js', function(req, res){

        var fs = require("fs");

        var filePath = require('path').resolve(__dirname, "./client-adapter.js");
        fs.readFile(filePath,function(err,data) {
            if (err) {
                res.send('<html><head></head><body>Error reading the file: client-adapter.js<br /></body></html>');
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
                        return element !== '.git' && fs.lstatSync(path.join(swaggerDescFolder, element)).isDirectory();
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
