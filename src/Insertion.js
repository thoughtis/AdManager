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

        define( [
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

        inventory = inventoryData.dynamicItems;
        localContext = inventoryData.localContext;

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

        // console.log('Inserting ad units with this inventory.', inventory)

        insertAdUnits();

        // console.log('done inserting ad units.')

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