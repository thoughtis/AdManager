/*!
 * admanager - A JavaScipt library for interacting with Google DFP.
 *
 * @author Athletics - http://athleticsnyc.com
 * @see https://github.com/athletics/AdManager
 * @version 0.6.4
 *//**
 * Shared utilities for debugging and array manipulation.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( 'src/Util',[
            'jquery'
        ], factory );

    } else if ( typeof exports === 'object' ) {

        module.exports = factory(
            require( 'jquery' )
        );

    } else {

        window.AdManager = window.AdManager || {};

        window.AdManager.Util = factory(
            window.jQuery
        );

    }

} ( window, function ( $ ) {

    'use strict';

    //////////////////////////////////////////////////////////////////////////////////////

    /**
     * Get the difference of two arrays.
     *
     * @param  {Array} array
     * @param  {Array} values
     * @return {Array} diff
     */
    function difference( array, values ) {

        var diff = [];

        $.grep( array, function ( element ) {
            if ( $.inArray( element, values ) === -1 ) {
                diff.push( element );
            }
        } );

        return diff;

    }

    /**
     * Remove array value by key.
     *
     * @param  {Array}   array
     * @param  {Integer} key
     * @return {Array}   array
     */
    function removeByKey( array, key ) {

        array = $.grep( array, function ( element, index ) {
            return index !== key;
        } );

        return array;

    }

    //////////////////////////////////////////////////////////////////////////////////////

    return {
        difference:  difference,
        removeByKey: removeByKey
    };

} ) );
/**
 * Import, get, and set configuration values.
 *
 * @todo  Initialization should die when no valid account or inventory.
 * @todo  Add optional dynamically-determined context for use in infinite scroll.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( 'src/Config',[
            'jquery'
        ], factory );

    } else if ( typeof exports === 'object' ) {

        module.exports = factory(
            require( 'jquery' )
        );

    } else {

        window.AdManager = window.AdManager || {};

        window.AdManager.Config = factory(
            window.jQuery
        );

    }

} ( window, function ( $ ) {

    'use strict';

    var config = {},
        defaults = {
            account:             null,               // DFP account ID
            autoload:            true,               // Start the qualification process automatically
            clientType:          false,              // Used to filter inventory
            context:             'body',             // Selector for ad filling container
            enabled:             true,               // Turn off ads
            insertionEnabled:    false,              // Enable dynamic insertion
            insertion:           {
                pxBetweenUnits:  0,                  // Additional space b/w dynamically inserted units
                adHeightLimit:   1000,               // Max-height for dynamic units
                uniqueClass : '',                    // Add a site-specific class to inserted units
                insertExclusion: [                   // Skip these elements when inserting units
                    'img',
                    'iframe',
                    'video',
                    'audio',
                    '.video',
                    '.audio',
                    '[data-ad-unit]'
                ]
            },
            inventory: [],                           // Inventory of ad units
            targeting: []                            // Key value pairs to send with DFP request
        };

    //////////////////////////////////////////////////////////////////////////////////////

    /**
     * Merge passed config with defaults.
     *
     * @fires AdManager:unitsInserted
     *
     * @param  {Object} newConfig
     */
    function init( newConfig ) {

        $( document ).on( 'AdManager:importConfig', onImportConfig );

        $.event.trigger( 'AdManager:importConfig', newConfig );

    }

    /**
     * Set config value by key.
     *
     * @param  {String} key
     * @param  {Mixed}  value
     * @return {Object} config
     */
    function set( key, value ) {

        return setConfigValue( config, key, value );

    }

    /**
     * Get config value by key.
     * Pass no key to get entire config object.
     *
     * @param  {String|Null} key Optional.
     * @return {Mixed}
     */
    function get( key ) {

        key = key || false;

        if ( ! key ) {
            return config;
        }

        return getConfigValue( config, key );

    }

    /**
     * Set config value.
     * Uses recursion to set nested values.
     *
     * @param  {Object} config
     * @param  {String} key
     * @param  {Mixed}  value
     * @return {Object} config
     */
    function setConfigValue( config, key, value ) {

        if ( typeof key === 'string' ) {
            key = key.split( '.' );
        }

        if ( key.length > 1 ) {
            setConfigValue( config[ key.shift() ], key, value );
        } else {
            config[ key[0] ] = value;
        }

        return config;

    }

    /**
     * Get config value.
     * Uses recursion to get nested values.
     *
     * @param  {Object} config
     * @param  {String} key
     * @return {Mixed}
     */
    function getConfigValue( config, key ) {

        if ( typeof key === 'string' ) {
            key = key.split( '.' );
        }

        if ( key.length > 1 ) {
            return getConfigValue( config[ key.shift() ], key );
        } else {
            return key[0] in config ? config[ key[0] ] : null;
        }

    }

    /**
     * Import new config.
     * Merges with the current config.
     *
     * @param  {Object} event
     * @param  {Object} newConfig
     * @return {Object} config
     */
    function onImportConfig( event, newConfig ) {

        config = $.extend( defaults, config, newConfig );

        return config;

    }

    //////////////////////////////////////////////////////////////////////////////////////

    return {
        init: init,
        set:  set,
        get:  get
    };

} ) );
/**
 * Get, filter, and augment the ad unit inventory.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( 'src/Inventory',[
            'jquery',
            './Util',
            './Config'
        ], function ( $, Util, Config ) {
            return factory( window, $, Util, Config );
        } );

    } else if ( typeof exports === 'object' ) {

        module.exports = factory(
            window,
            require( 'jquery' ),
            require( './Util' ),
            require( './Config' )
        );

    } else {

        window.AdManager = window.AdManager || {};

        window.AdManager.Inventory = factory(
            window,
            window.jQuery,
            window.AdManager.Util,
            window.AdManager.Config
        );

    }

} ( window, function ( window, $, Util, Config ) {

    'use strict';

    //////////////////////////////////////////////////////////////////////////////////////

    /**
     * Get sanitized inventory.
     *
     * @return {Object}
     */
    function getInventory() {

        return getAvailableSizes( inventoryCleanTypes( Config.get( 'inventory' ) ) );

    }

    /**
     * Add default unit type if not set.
     *
     * @todo   Should this edit the inventory in the Config?
     *
     * @param  {Array} inventory
     * @return {Array} inventory
     */
    function inventoryCleanTypes( inventory ) {

        for ( var i = 0; i < inventory.length; i++ ) {

            if ( typeof inventory[ i ].type !== 'undefined' ) {
                continue;
            }

            inventory[ i ].type = 'default';

        }

        return inventory;

    }

    /**
     * Remove sizes from inventory that will not display properly.
     *
     * @todo   Clarify what this function is limiting, and remove the
     *         hard limits set to use desktop width for tablets.
     *
     * @param  {Array} inventory
     * @return {Array} inventory
     */
    function getAvailableSizes( inventory ) {

        var width = window.innerWidth > 0 ? window.innerWidth : screen.width;

        if ( width > 1100 ) {
            return inventory;
        }

        for ( var i = 0; i < inventory.length; i++ ) {
            var sizesToRemove = [];
            for ( var j = 0; j < inventory[ i ].sizes.length; j++ ) {
                if ( inventory[ i ].sizes[ j ][0] > width ) {
                    sizesToRemove.push( inventory[ i ].sizes[ j ] );
                }
            }
            inventory[ i ].sizes = Util.difference( inventory[ i ].sizes, sizesToRemove );
        }

        return inventory;

    }

    /**
     * Get ad units for dynamic insertion.
     *
     * @todo   Replace `$.each` with `$.grep`.
     *
     * @return {Object}
     */
    function getDynamicInventory() {

        var dynamicItems = [],
            type = Config.get( 'clientType' ),
            inventory = getInventory(),
            localContext;

        $.each( inventory, function ( index, position ) {
            if ( ( typeof position.dynamic !== 'undefined' ) && ( position.dynamic === true ) ) {
                if ( ! type || type === position.type ) {
                    dynamicItems.push( position );
                    localContext = position.localContext;
                }
            }
        } );

        return {
            dynamicItems: dynamicItems,
            localContext: localContext
        };

    }

    /**
     * Get info about an ad unit by slot ID.
     *
     * @param  {String} slotId
     * @return {Object} adInfo
     */
    function getAdInfo( slotId ) {

        var adInfo = {},
            inventory = getInventory();

        for ( var i = 0; i < inventory.length; i++ ) {
            if ( inventory[ i ].id !== slotId ) {
                continue;
            }

            adInfo = inventory[ i ];

            break;
        }

        return adInfo;

    }

    /**
     * Get shortest possible height for unit.
     *
     * @todo   Consider abstracting shortest and tallest
     *         functions into one.
     *
     * @param  {Object}  unit
     * @return {Integer} shortest
     */
    function shortestAvailable( unit ) {

        var shortest = 0;

        $.each( unit.sizes, function ( index, sizes ) {
            if ( shortest === 0 ) {
                shortest = sizes[1];
            } else if ( sizes[1] < shortest ) {
                shortest = sizes[1];
            }
        } );

        return shortest;

    }

    /**
     * Get tallest possible height for unit.
     *
     * @todo   Consider abstracting shortest and tallest
     *         functions into one.
     *
     * @param  {Object}  unit
     * @return {Integer} tallest
     */
    function tallestAvailable( unit ) {

        var tallest = 0;

        $.each( unit.sizes, function ( index, sizes ) {
            if ( sizes[1] > tallest ) {
                tallest = sizes[1];
            }
        } );

        return tallest;

    }

    /**
     * Limit ad unit sizes.
     * Removes heights too large for context.
     *
     * @param  {Object}  unit
     * @param  {Integer} limit
     * @return {Object}  unit
     */
    function limitUnitHeight( unit, limit ) {

        $.each( unit.sizes, function ( index, sizes ) {
            if ( sizes[1] <= limit ) {
                return true;
            }
            unit.sizes = Util.removeByKey( unit.sizes, index );
        } );

        return unit;

    }

    /**
     * Finds the unit by slot name and returns its type.
     * Type is used to filter the inventory (like desktop and mobile).
     *
     * @param  {String} slotId
     * @return {String} type
     */
    function getUnitType( slotId ) {

        var type = 'default';

        $.each( getInventory(), function ( index, unit ) {

            if ( unit.slot !== slotId ) {
                return true;
            }

            type = unit.type;

            return false;

        } );

        return type;

    }

    //////////////////////////////////////////////////////////////////////////////////////

    return {
        getInventory:        getInventory,
        getAdInfo:           getAdInfo,
        getDynamicInventory: getDynamicInventory,
        shortestAvailable:   shortestAvailable,
        tallestAvailable:    tallestAvailable,
        limitUnitHeight:     limitUnitHeight,
        getUnitType:         getUnitType
    };

} ) );
/**
 * Handles the request and display of ads.
 *
 * @todo  Allow for multiple inits, only bind events
 *        and load library once.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( 'src/Manager',[
            'jquery',
            './Config',
            './Inventory'
        ], function ( $, Config, Inventory ) {
            return factory( window, $, Config, Inventory );
        } );

    } else if ( typeof exports === 'object' ) {

        module.exports = factory(
            window,
            require( 'jquery' ),
            require( './Config' ),
            require( './Inventory' )
        );

    } else {

        window.AdManager = window.AdManager || {};

        window.AdManager.Manager = factory(
            window,
            window.jQuery,
            window.AdManager.Config,
            window.AdManager.Inventory
        );

    }

} ( window, function ( window, $, Config, Inventory ) {

    'use strict';

    var loaded = false,
        definedSlots = [],
        pagePositions = [],
        inventory = [],
        account = null,
        adSelector = '[data-ad-unit]';

    //////////////////////////////////////////////////////////////////////////////////////

    /**
     * Add event listeners and get the DFP library.
     */
    function init() {

        if ( ! Config.get( 'enabled' ) ) {
            return;
        }

        inventory = Inventory.getInventory();
        account = Config.get( 'account' );

        addEventListeners();
        loadLibrary();

    }

    function addEventListeners() {

        $( document )
            .on( 'AdManager:libraryLoaded', libraryLoaded )
            .on( 'AdManager:runSequence', runSequence )
            .on( 'AdManager:slotsDefined', displayPageAds )
            .on( 'AdManager:refresh', refresh )
            .on( 'AdManager:emptySlots', emptySlots )
            .on( 'AdManager:emptySlotsInContext', emptySlotsInContext );

    }

    /**
     * Library loaded callback.
     *
     * @fires AdManager:runSequence
     * @fires AdManager:ready
     */
    function libraryLoaded() {

        loaded = true;

        listenForDfpEvents();
        setupPubAdsService();

        if ( Config.get( 'autoload' ) ) {
            $.event.trigger( 'AdManager:runSequence' );
        }

        $.event.trigger( 'AdManager:ready' );

    }

    /**
     * Run qualification sequence.
     *
     * - Find page positions in the DOM
     * - Define new slots
     */
    function runSequence() {

        pagePositions = [];
        setTargeting();
        setPagePositions();
        defineSlotsForPagePositions();

    }

    /**
     * Asynchronously load the DFP library.
     * Calls ready event when fully loaded.
     */
    function loadLibrary() {

        if ( loaded ) {
            return onLibraryLoaded();
        }

        var googletag,
            gads,
            useSSL,
            node,
            readyStateLoaded = false
        ;

        window.googletag = window.googletag || {};
        window.googletag.cmd = window.googletag.cmd || [];

        gads = document.createElement( 'script' );
        gads.async = true;
        gads.type = 'text/javascript';
        useSSL = 'https:' == document.location.protocol;
        gads.src = ( useSSL ? 'https:' : 'http:' ) + '//www.googletagservices.com/tag/js/gpt.js';
        if ( gads.addEventListener ) {
            gads.addEventListener( 'load', onLibraryLoaded, false );
        } else if ( gads.readyState ) {
            gads.onreadystatechange = function () {
                // Legacy IE
                if ( ! readyStateLoaded ) {
                    readyStateLoaded = true;
                    onLibraryLoaded();
                }
            };
        }
        node = document.getElementsByTagName( 'script' )[0];
        node.parentNode.insertBefore( gads, node );

    }

    /**
     * Callback when GPT library is loaded.
     *
     * @fires AdManager:libraryLoaded
     */
    function onLibraryLoaded() {

        googletag.cmd.push( function () {
            $.event.trigger( 'AdManager:libraryLoaded' );
        } );

    }

    /**
     * Add a listener for the GPT `slotRenderEnded` event.
     */
    function listenForDfpEvents() {

        googletag.cmd.push( function () {
            googletag.pubads().addEventListener( 'slotRenderEnded', onSlotRenderEnded );
        } );

    }

    /**
     * Enable batched SRA calls for requesting multiple ads at once.
     * Disable initial load of units, wait for display call.
     */
    function setupPubAdsService() {

        googletag.cmd.push( function () {

            // https://developers.google.com/doubleclick-gpt/reference#googletag.PubAdsService_collapseEmptyDivs
            googletag.pubads().collapseEmptyDivs();

            // https://developers.google.com/doubleclick-gpt/reference#googletag.PubAdsService_enableSingleRequest
            googletag.pubads().enableSingleRequest();

            // https://developers.google.com/doubleclick-gpt/reference#googletag.PubAdsService_disableInitialLoad
            googletag.pubads().disableInitialLoad();

        } );

    }

    /**
     * Send key-value targeting in ad request.
     *
     * @todo  https://developers.google.com/doubleclick-gpt/reference#googletag.PubAdsService_clearTargeting
     */
    function setTargeting() {

        googletag.cmd.push( function () {

            var targeting = Config.get( 'targeting' );

            if ( $.isEmptyObject( targeting ) ) {
                return;
            }

            $.each( targeting, function ( key, value ) {
                googletag.pubads().setTargeting( key, value );
            } );

        } );

    }

    /**
     * Looks for ad unit markup in the context to build a list
     * of units to request.
     */
    function setPagePositions() {

        var clientType = Config.get( 'clientType' ),
            $context = $( Config.get( 'context' ) ),
            $units = null,
            selector = adSelector + ':not(.is-disabled)'
        ;

        if ( clientType !== false ) {
            selector += '[data-client-type="' + clientType + '"]';
        }

        $units = $context.find( selector );

        $units.each( function () {
            pagePositions.push( $( this ).data( 'ad-id' ) );
        } );

    }

    /**
     * Define slots for page positions.
     *
     * @fires AdManager:slotsDefined
     */
    function defineSlotsForPagePositions() {

        googletag.cmd.push( function () {

            var undefinedPagePositions = [];

            if ( $.isEmptyObject( definedSlots ) ) {

                undefinedPagePositions = pagePositions;

            } else {

                var definedSlotIds = $.map( definedSlots, function ( slot, index ) {
                    return slot.getSlotElementId();
                } );

                undefinedPagePositions = $.grep( pagePositions, function ( slotId, index ) {

                    if ( $.inArray( slotId, definedSlotIds ) !== -1 ) {
                        return false;
                    }

                    return true;

                } );
            }

            $.each( undefinedPagePositions, function ( index, slotId ) {

                var position = Inventory.getAdInfo( slotId ),
                    slotName = convertSlotName( position.slot, 'dfp' ),
                    slot     = googletag.defineSlot( slotName, position.sizes, position.id );

                slot.addService( googletag.pubads() );

                // Slot specific targeting via the prev_scp parameter

                if ( 'targeting' in position && false === $.isEmptyObject( position.targeting ) ) {

                     $.each( position.targeting, function ( key, value ) {

                        slot.setTargeting( key, value );

                    } );

                }

                definedSlots.push( slot );

            } );

            // Enables GPT services for defined slots.
            googletag.enableServices();

            insertUnitTargets();

            $.event.trigger( 'AdManager:slotsDefined' );

        } );

    }

    /**
     * Creates the containers for the DFP to fill.
     * DFP wants ids.
     */
    function insertUnitTargets() {

        var $context = $( Config.get( 'context' ) ),
            notInserted = [];

        notInserted = $.grep( pagePositions, function ( slotId, index ) {
            return document.getElementById( slotId ) === null;
        } );

        $.each( notInserted, function ( index, slotId ) {

            $context.find( '[data-ad-id="' + slotId + '"]' )
                .addClass( 'is-initialized' )
                .append( $( '<div />', {
                    id: slotId,
                    addClass: 'ad-unit-target'
                } ) );

        } );

    }

    /**
     * Fetch and display the current page ads.
     */
    function displayPageAds() {

        // Set additional targeting from Header Bidding
        $.event.trigger( 'AdManager:headerBidding' );

        googletag.cmd.push( function () {

            var pageSlots = $.grep( definedSlots, function ( slot, index ) {

                var slotId = slot.getSlotElementId();

                return -1 !== $.inArray( slotId, pagePositions );

            } );

            $.each( pagePositions, function ( index, slotId ) {

                googletag.display( slotId );

            } );

            googletag.pubads().refresh( pageSlots, { changeCorrelator : false } );

        } );

    }

    /**
     * Callback from DFP rendered event.
     *
     * @fires AdManager:adUnitRendered
     * @see   https://developers.google.com/doubleclick-gpt/reference
     *
     * @param {Object} unit
     */
    function onSlotRenderEnded( unit ) {

        var slotName = convertSlotName( unit.slot.getAdUnitPath(), 'local' );

        $.event.trigger( 'AdManager:adUnitRendered', {
            name:        slotName,
            size:        unit.size,
            isEmpty:     unit.isEmpty,
            creativeId:  unit.creativeId,
            lineItemId:  unit.lineItemId,
            serviceName: unit.serviceName
        } );

    }

    /**
     * Get defined slot by name.
     *
     * @todo   Use `$.grep` instead of `$.each`.
     *
     * @param  {String} slotId
     * @return {Object} definedSlot
     */
    function getDefinedSlot( slotId ) {

        var definedSlot = null;

        $.each( definedSlots, function ( i, slot ) {
            var unitId = slot.getSlotElementId();
            if ( unitId === slotId ) {
                definedSlot = slot;
                return false;
            }
        } );

        return definedSlot;

    }

    /**
     * Display slot by ID or slot.
     * Separate display call from `displayPageAds()`.
     *
     * @param {String} slotId
     */
    function displaySlot( slotId ) {

        googletag.cmd.push( function () {

            var slot = getDefinedSlot( slotId );

            googletag.display( slotId );
            googletag.pubads().refresh( [ slot ] );

            pagePositions = $.grep( pagePositions, function ( pagePosition, index ) {
                return slotId !== pagePosition;
            } );

        } );

    }

    /**
     * Empty slots by name. Removes their target container,
     *
     * @param  {Object} event
     * @param  {Array}  units List of slot Ids.
     */

    function emptySlots( event, unitIds ) {

        var units = $.map( unitIds, function ( id, index ) {
            return getDefinedSlot( id );
        } );

        googletag.pubads().clear( units );

        $.each( unitIds, function ( index, id ) {
            $( document.getElementById( id ) ).remove();
        } );

    }

    /**
     * Empties all ads in a given context.
     *
     * @param  {Object} event
     * @param  {Object}  options
     *         {Array}   $context        jQuery element.
     *         {Boolean} removeContainer Default is true.
     */
    function emptySlotsInContext( event, options ) {

        options = options || {};
        options = $.extend( {
            $context:        $( Config.get( 'context' ) ),
            removeContainer: true
        }, options );

        var containers = options.$context.find( adSelector );

        var units = $.map( containers, function ( unit, index ) {
            return getDefinedSlot( $( unit ).data( 'ad-id' ) );
        } );

        googletag.pubads().clear( units );

        if ( options.removeContainer ) {
            $( containers ).remove();
        } else {
            $( containers ).empty();
        }

    }

    /**
     * Converts a slot name local to DFP or vice versa.
     *
     * @param  {String} slotName
     * @param  {String} format   'dfp' or 'local'.
     * @return {String}
     */
    function convertSlotName( slotName, format ) {

        if ( 'dfp' === format ) {
            return '/' + account + '/' + slotName;
        }

        return slotName.replace( '/' + account + '/', '' );

    }

    /**
     * Refresh slots.
     *
     * @param  {Object} event
     * @param  {Array}  units Optional. List of units to refresh.
     *                        Default is all.
     */
    function refresh( event, units ) {

        units = units || definedSlots;

        googletag.cmd.push( function () {
            googletag.pubads().refresh( units );
        } );

    }

    //////////////////////////////////////////////////////////////////////////////////////

    return {
        init:                init,
        displaySlot:         displaySlot,
        runSequence:         runSequence,
        emptySlots:          emptySlots,
        emptySlotsInContext: emptySlotsInContext,
        refresh:             refresh
    };

} ) );
/**
 * Dynamically insert ad units into container.
 * Avoids ads and other problematic elements.
 *
 * @todo  Insert the previously inserted units in an infinite scroll context.
 * @todo  Update language to `node` and `nodes` everywhere for consistency.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( 'src/Insertion',[
            'jquery',
            './Util',
            './Config',
            './Inventory'
        ], factory );

    } else if ( typeof exports === 'object' ) {

        module.exports = factory(
            require( 'jquery' ),
            require( './Util' ),
            require( './Config' ),
            require( './Inventory' )
        );

    } else {

        window.AdManager = window.AdManager || {};

        window.AdManager.Insertion = factory(
            window.jQuery,
            window.AdManager.Util,
            window.AdManager.Config,
            window.AdManager.Inventory
        );

    }

} ( window, function ( $, Util, Config, Inventory ) {

    'use strict';

    var $context = null,
        $localContext = null,
        inContent = false,
        inventory = [],
        odd = true,
        localContext = null,
        adSelector = '[data-ad-unit]';

    //////////////////////////////////////////////////////////////////////////////////////

    /**
     * Bind init event listener.
     * Begins qualification procedure when the DOM is ready.
     *
     * @todo  Check if is already attached.
     */
    function init() {

        $( document ).on( 'AdManager:initSequence', qualifyContext );

    }

    /**
     * Sets the context jQuery object variable.
     *
     * @todo  Consider resetting variable to `null` when
     *        no longer needed in a pushState context.
     */
    function setContext() {

        $context = $( Config.get( 'context' ) );

    }

    /**
     * First qualify the DOM context where ads are to be inserted
     * to determine if insertion should proceed.
     */
    function qualifyContext() {

        var inventoryData = Inventory.getDynamicInventory();

        inventory = inventory.length ? inventory : inventoryData.dynamicItems;
        localContext = localContext ? localContext : inventoryData.localContext;

        // No dynamic inventory.
        if ( ! inventory.length ) {
            return broadcast();
        }

        setContext();
        $localContext = $context.find( localContext ).first();

        // Detect a local context.
        if ( $localContext.length ) {
            inContent = true;
        }

        // There is no insertion selector.
        if ( ! inContent ) {
            return broadcast();
        }

        insertAdUnits();

    }

    /**
     * Triggers ad units inserted event.
     *
     * @fires AdManager:unitsInserted
     */
    function broadcast() {

        $.event.trigger( 'AdManager:unitsInserted' );

    }

    /**
     * Is Insertion Enabled?
     *
     * @return {Boolean} Probably!
     */
    function isEnabled() {

        return Config.get( 'insertionEnabled' );

    }

    /**
     * Run in-content insertion.
     *
     * @todo  Does this need the extra check?
     */
    function insertAdUnits() {

        if ( inContent ) {
            denoteValidInsertions();
            insertSecondaryUnits();
        }

        broadcast();

    }

    /**
     * Walks DOM elements in the local context.
     * Sets a data attribute if element is a valid insertion location.
     *
     * @todo  Potentially use `$.grep` to filter nodes for faster parsing.
     * @todo  Use `for` loop or `$.grep` to check for excluded elements.
     */
    function denoteValidInsertions() {

        var $nodes = $localContext.children(),
            excluded = Config.get( 'insertion.insertExclusion' )
        ;

        $nodes.each( function ( i ) {

            var $element = $( this ),
                valid = true
            ;

            $.each( excluded, function ( index, item ) {
                if ( $element.is( item ) || $element.find( item ).length ) {
                    valid = false; // not valid
                    return false; // break loop
                }
            } );

            $element.attr( 'data-valid-location', valid );

        } );

    }

    /**
     * Check if node should be skipped.
     *
     * @param  {Object}  $element
     * @return {Boolean}
     */
    function isValidInsertionLocation( $element ) {

        return JSON.parse( $element.data( 'valid-location' ) );

    }

    /**
     * Generate ad unit markup.
     * Creates DOM node to attach to the DOM.
     *
     * @see    https://vip.wordpress.com/2015/03/25/preventing-xss-in-javascript/
     * @param  {String}  slotId
     * @return {Array}   $html
     */
    function adUnitMarkup( slotId ) {

        var adInfo      = Inventory.getAdInfo( slotId ),
            $html       = $( '<div />' ),
            uniqueClass = Config.get( 'insertion.uniqueClass' );

        $html
            .attr( 'data-ad-id', adInfo.id )
            .attr( 'data-ad-unit', adInfo.slot )
            .attr( 'data-client-type', adInfo.type )
            .addClass( 'in-content' );

        if ( 'string' == typeof uniqueClass && '' !== uniqueClass ) {
            $html.addClass( uniqueClass );
        }

        return $html;

    }

    /**
     * Inserts the secondary units, which can appear below the fold.
     */
    function insertSecondaryUnits() {

        var pxBetweenUnits = Config.get( 'insertion.pxBetweenUnits' );

        $.each( inventory, function ( index, unit ) {

            var tallest  = Inventory.tallestAvailable( unit ),
                force    = ( 0 === index ),
                location = findInsertionLocation( {
                    height: tallest + pxBetweenUnits,
                    force: force
                })
            ;

            if ( ! location ) {
                return false;
            }

            var markup = adUnitMarkup( unit.id );

            location.$insertBefore.before( markup );

        } );

    }

    /**
     * Find insertion location.
     * Considers distance between units and valid locations.
     *
     * @todo   Convert `$.each` to `for` loop.
     *         Use `continue` and `break` for clarity.
     *
     * @param  {Object}         options
     * @return {Object|Boolean}         False on failure.
     */
    function findInsertionLocation( options ) {

        options = options || {};

        var $nodes = getNodes();

        if ( ! $nodes.length ) {
            return false;
        }

        var nodeSearch = new NodeSearch( {
            $nodes: $nodes,
            force: options.force,
            height: options.height
        } );

        nodeSearch.findLocation();

        if ( ! nodeSearch.locationFound ) {
            return false;
        }

        return {
            '$insertBefore': nodeSearch.$insertBefore
        };

    }

    /**
     * Search prototype used for determining insertion points.
     *
     * @param  {Object} options
     */
    function NodeSearch( options ) {

        this.$nodes = options.$nodes;
        this.validHeight = 0;
        this.marginDifference = 64;
        this.inserted = [];
        this.$insertBefore = null;
        this.locationFound = false;
        this.exitLoop = false;
        this.height = options.height;
        this.force = options.force;
        this.neededHeight = options.height + this.marginDifference;
        this.adUnitIndex = options.adUnitIndex;

    }

    NodeSearch.prototype.findLocation = function() {

        var self = this;

        // Loop through each node as necessary.
        // `verifyNode()` returns true when found.
        // Break the loop when true.
        $.each( self.$nodes, function ( i, node ) {

            return true !== self.verifyNode( i, $( node ) ) ? true : false;

        } );

        self.invalidateUsedNodes();

    };

    /**
     * Nodes next to an ad are no longer valid locations
     *
     * @todo  Consistently use `.attr()` or `.data()` when setting.
     *        jQuery does not need the DOM to change for data attributes.
     */
    NodeSearch.prototype.invalidateUsedNodes = function () {

        if ( ! this.inserted.length ) {
            return;
        }

        $.each( this.inserted, function ( index, item ) {
            $( item ).data( 'valid-location', false );
        } );

    };

    /**
     * Verify each node to find a suitable insertion point.
     *
     * @return {Boolean}
     */
    NodeSearch.prototype.verifyNode = function ( index, $node ) {

        // Avg outerHeight to negate overlapping margins
        var height = ( ( $node.outerHeight( true ) + $node.outerHeight() ) / 2 ),
            isLastNode = this.$nodes.length === index + 1;

        if ( isValidInsertionLocation( $node ) ) {

            // Valid, so increment height
            this.validHeight += height;
            this.inserted.push( $node );

        } else {

            // Reset Height When You Hit Something Invalid
            this.validHeight = 0;
            this.inserted = [];

        }

        if ( this.validHeight >= this.neededHeight || ( this.force && isLastNode ) ) {

            this.exitLoop = true;

            if ( 0 < this.inserted.length ) {

                 // Insert ad before the first valid node
                this.$insertBefore  = this.inserted[0];
                this.locationFound  = true;

            }

        }

        return this.exitLoop;

    };

    /**
     * Is Element an Ad Unit?
     *
     * @param  {Mixed}   $el
     * @return {Boolean}
     */
    function isThisAnAd( $el ) {

        if ( ! $el ) {
            return false;
        }

        return $el.is( adSelector );

    }

    /**
     * Get next group of nodes to loop through.
     * Grabs the nodes after previous unit or all nodes if no previous.
     *
     * @return {Array} $nodes
     */
    function getNodes() {

        var $prevUnit = $localContext.find( adSelector ).last(),
            $nodes = null;

        if ( $prevUnit.length ) {
            $nodes = $prevUnit.nextAll( $localContext );
        } else {
            $nodes = $localContext.children();
        }

        return $nodes;

    }

    //////////////////////////////////////////////////////////////////////////////////////

    return {
        init: init
    };

} ) );
/**
 * Builds the AdManager prototype.
 * This file should be required directly for CommonJS usage.
 *
 * @see  http://requirejs.org/docs/commonjs.html#intro On CommonJS Transport.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( 'src/Index',[
            './Util',
            './Config',
            './Inventory',
            './Manager',
            './Insertion'
        ], factory );

    } else if ( typeof exports === 'object' ) {

        module.exports = factory(
            require( './Util' ),
            require( './Config' ),
            require( './Inventory' ),
            require( './Manager' ),
            require( './Insertion' )
        );

    } else {

        var _AdManager = window.AdManager;

        window.AdManager = factory(
            _AdManager.Util,
            _AdManager.Config,
            _AdManager.Inventory,
            _AdManager.Manager,
            _AdManager.Insertion
        );

    }

} ( window, function ( Util, Config, Inventory, Manager, Insertion ) {

    'use strict';

    /**
     * AdManager prototype.
     *
     * @param  {Object} newConfig Required configuration for initialization.
     * @throws {Error}            When no configuration is specified.
     */
    function AdManager( newConfig ) {

        newConfig = newConfig || false;

        if ( ! newConfig ) {
            throw new Error( 'Please provide a config.' );
        }

        Config.init( newConfig );
        Insertion.init();
        Manager.init();

    }

    var module = AdManager.prototype;

    module.Util = Util;
    module.Config = Config;
    module.Inventory = Inventory;
    module.Manager = Manager;
    module.Insertion = Insertion;

    return AdManager;

} ) );
