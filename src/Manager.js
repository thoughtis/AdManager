/**
 * Handles the request and display of ads.
 *
 * @todo  Allow for multiple inits, only bind events
 *        and load library once.
 */
( function ( window, factory ) {

    'use strict';

    if ( typeof define === 'function' && define.amd ) {

        define( [
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

        // Called when GPT is Available
        window.googletag.cmd.push( onLibraryLoaded )

        gads = document.createElement( 'script' );
        gads.async = true;
        gads.type = 'text/javascript';
        gads.src = 'https://www.googletagservices.com/tag/js/gpt.js';

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
            selector = adSelector;
        ;

        if ( clientType !== false ) {
            selector += '[data-client-type="' + clientType + '"]';
        }

        selector += ':not(.is-disabled)';

        $context.find( selector ).each( function () {

            var id = $( this ).data( 'ad-id' );
            var adInfo = Inventory.getAdInfo( id );

            if ( 'id' in adInfo ) {
                pagePositions.push( id );
            }

        });

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

            $.event.trigger( 'AdManager:requestSent' );

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
            id:          unit.slot.getSlotElementId(),
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

        // Convert element IDs to googletag slot references
        units = $.map( units, function ( unit ) {
            return 'string' === typeof unit ? getDefinedSlot( unit ) : unit;
        } );

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