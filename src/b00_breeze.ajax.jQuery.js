// jQuery ajax adapter ( JQuery v.>=1.5 )
// see https://api.jquery.com/jQuery.ajax/
(function(factory) {
    // Module systems magic dance.
    if (breeze) {
        factory(breeze);
    } else if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
        // CommonJS or Node: hard-coded dependency on "breeze"
        factory(require("breeze"));
    } else if (typeof define === "function" && define["amd"]) {
        // AMD anonymous module with hard-coded dependency on "breeze"
        define(["breeze"], factory);
    }
}(function(breeze) {
    "use strict";
    var core = breeze.core;
    
    var jQuery;
    
    var ctor = function () {
        this.name = "jQuery";
        this.defaultSettings = { };
        this.requestInterceptor = null;
    };
    var proto = ctor.prototype;

    proto.initialize = function () {
        // look for the jQuery lib but don't fail immediately if not found
        jQuery = core.requireLib("jQuery");
    };

    proto.ajax = function (config) {
        if (!jQuery) {
            throw new Error("Unable to locate jQuery");
        }
        var jqConfig = {
            type: config.type, 
            url: config.url,
            data: config.params || config.data,
            dataType: config.dataType,
            contentType: config.contentType,
            crossDomain: config.crossDomain,
            headers: config.headers || {}
        }
        
        if (!core.isEmpty(this.defaultSettings)) {
            var compositeConfig = core.extend({}, this.defaultSettings);
            jqConfig = core.extend(compositeConfig, jqConfig);
            // extend is shallow; extend headers separately
            jqConfig.headers = core.extend(this.defaultSettings.headers, jqConfig.headers);
        }
        
        var requestInfo = {
            adapter: this,      // this adapter
            config: jqConfig,   // jQuery's ajax 'settings' object
            zConfig: config,    // the config arg from the calling Breeze data service adapter
            success: successFn, // adapter's success callback
            error: errorFn      // adapter's error callback
        }

        if (core.isFunction(this.requestInterceptor)){
            this.requestInterceptor(requestInfo);
            if (this.requestInterceptor.oneTime){
                this.requestInterceptor = null;
            }
        }

        if (requestInfo.config){
            requestInfo.jqXHR = jQuery.ajax(requestInfo.config)
            .done(requestInfo.success)
            .fail(requestInfo.error); 
        }

        function successFn(data, statusText, jqXHR) {
		var httpResponse;
		var xRespondedJson = jqXHR.getResponseHeader("X-Responded-JSON");
		if (xRespondedJson != undefined) {
			var xRespondedObj = JSON.parse(xRespondedJson);
			httpResponse = {
	                    data: data,
	                    status: xRespondedObj.status != undefined ? xRespondedObj.status : jqXHR.status,
	                    getHeaders: getMergedHeadersFn(XHR, xRespondedObj.headers),
	                    error: data.Message,
	                    config: config
	                };
		} else {
			var httpResponse = {
		                config: config,
		                data: data,
		                getHeaders: getHeadersFn(jqXHR),
		                status: jqXHR.status,
		                statusText: statusText
		            };
		}
            if (httpResponse.status >= 300) {
                config.error(httpResponse);
            } else {
                config.success(httpResponse);
            }
            jqXHR.onreadystatechange = null;
            jqXHR.abort = null;               
        }

        function errorFn(jqXHR, statusText, errorThrown) {
            var httpResponse = {
                config: config,
                data: jqXHR.responseText,
                error: errorThrown,
                getHeaders: getHeadersFn(jqXHR),
                status: jqXHR.status,
                statusText: statusText
            };
            config.error(httpResponse);
            jqXHR.onreadystatechange = null;
            jqXHR.abort = null;               
        }
    };
    
    function getHeadersFn(jqXHR) {
        if (jqXHR.status === 0) { // timeout or abort; no headers
            return function (headerName) {
                return (headerName && headerName.length > 0) ? "" : {};
            };
        } else { // jqXHR should have header functions          
            return function (headerName) {
                return (headerName && headerName.length > 0) ?
                    jqXHR.getResponseHeader(headerName) :
                    jqXHR.getAllResponseHeaders();
            };
        } 
    }
    
	//Returns headers from XHR object as well as headers from additional container
	//We need it cause MVC 5 now returns 'X-Responded-JSON' header containing JSON object with additional 'headers' property
    function getMergedHeadersFn(XHR, additionalHeaders) {
        if (additionalHeaders == undefined) return getHeadersFn(XHR);

        return function (headerName) {
            if (headerName && headerName.length > 0) {
                var header = XHR.getResponseHeader(headerName);
                return header != undefined ? header : additionalHeaders[headerName];
            } else {
                var headers = XHR.getAllResponseHeaders();
                for (var propname in additionalHeaders) {
                    headers = headers.replace(/^\s+|\s+$/g, '') + '\n' + propname + ': ' + additionalHeaders[propname];
                }
                return headers;
            };
        };
    }

    breeze.config.registerAdapter("ajax", ctor);
    
}));
