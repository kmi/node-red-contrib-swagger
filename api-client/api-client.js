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

    var swagger = require('swagger-client');
    var util = require("util");
    
    // The main node definition - most things happen in here
    function ApiClient(n) {
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

        var node = this;

        if (this.swaggerClient === undefined || this.swaggerClient == null ||
            this.swaggerClient.url != node.api) {

            this.swaggerClient = new swagger.SwaggerApi({
                url: node.api,
                useJQuery: true,
                success: function() {
                    if (this.ready) {
                        util.log("[api-client] Client created for: " + this.url);
                    }
                },
                // define failure function
                failure: function() {
                    util.warn("[api-client] Unable to create client for: " + this.url);
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
                    console.error(error.stack);
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
    RED.nodes.registerType("api-client",ApiClient);
    
}
