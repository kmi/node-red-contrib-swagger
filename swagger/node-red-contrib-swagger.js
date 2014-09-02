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

    var fs = require("fs");
    var swagger = require('swagger-client');

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
        this.credentials = n.credentials;

        var node = this;

        if (node.swaggerClient == undefined || node.swaggerClient.url !== node.api) {

            node.swaggerClient = new swagger.SwaggerApi({
                url: node.api,
//                useJQuery: true,
                success: function() {
                    if (this.ready) {
                        node.log("Client created for: " + node.api);
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
                    resp = {status: response.status, payload: JSON.parse(response.data)};
                } catch (error) {
                    console.error(error.stack);
                    resp = {status: response.status, payload: response.data.toString()};
                }
            }
            node.error(resp);
        };

        // Auth schemes required for all operations within that api
//        swagger.apis['apiName'].api.authSchemes

        // Can be overriden by the operation





        this.on("input", function(msg) {
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
                    // Parse as json if the input is to be considered json or leave as it is
                    if (opts["requestContentType"] != undefined && opts["requestContentType"] !== "application/json") {
                        params = msg.payload;
                    } else {
                        params = JSON.parse(msg.payload);
                    }
                }

                // Disable until issue 101 on swagger.js is sorted
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
