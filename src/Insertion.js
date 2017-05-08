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
     * @todo  Clarify `$prev` check.
     */
    function denoteValidInsertions() {

        var $nodes = $localContext.children(),
            excluded = Config.get( 'insertion.insertExclusion' )
        ;

        $nodes.each( function ( i ) {

            var $element = $( this ),
                $prev = i > 0 ? $nodes.eq( i - 1 ) : false,
                valid = true
            ;

            $.each( excluded, function ( index, item ) {
                if ( $element.is( item ) || $element.find( item ).length ) {
                    valid = false; // not valid
                    return false; // break loop
                }
            } );

            if ( $prev && $prev.is( 'p' ) && $prev.find( 'img' ).length === 1 ) {
                valid = false;
            }

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

        return $.parseJSON( $element.data( 'valid-location' ) );

    }

    /**
     * Generate ad unit markup.
     * Creates DOM node to attach to the DOM.
     *
     * @see    https://vip.wordpress.com/2015/03/25/preventing-xss-in-javascript/
     * @param  {String}  slotName
     * @param  {Boolean} disableFloat
     * @return {Array}   $html
     */
    function adUnitMarkup( slotName, disableFloat ) {

        disableFloat = disableFloat || false;

        var type = Inventory.getUnitType( slotName ),
            alignment = odd ? 'odd' : 'even',
            $html = $( '<div />' ),
            uniqueClass = Config.get( 'insertion.uniqueClass' );

        $html
            .attr( 'data-ad-unit', slotName )
            .attr( 'data-client-type', type );

        if ( 'string' == typeof uniqueClass && '' !== uniqueClass ) {
            $html.addClass( uniqueClass );
        }

        if ( disableFloat ) {
            $html
                .addClass( 'disable-float' );
        } else {
            $html
                .addClass( 'in-content' )
                .addClass( alignment );
        }

        if ( ! disableFloat ) {
            odd = ! odd;
        }

        return $html;

    }

    /**
     * Inserts the secondary units, which can appear below the fold.
     */
    function insertSecondaryUnits() {

        $.each( inventory, function ( index, unit ) {

            var tallest = Inventory.tallestAvailable( unit ),
                location = findInsertionLocation( {
                    height: tallest + Config.get( 'insertion.pxBetweenUnits' )
                } ),
                markup = null
            ;

            if ( ! location ) {
                return false;
            }

            markup = adUnitMarkup( unit.slot, location.disableFloat );
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

        var $nodes = getNodes(),
            nodeSearch = new NodeSearch( {
                $nodes: $nodes,
                force: options.force ? options.force : false,
                limit: options.limit ? options.limit : false,
                height: options.height
            } )
        ;

        if ( ! $nodes.length ) {
            return false;
        }

        // Loop through each node as necessary.
        // `verifyNode()` returns true when found.
        // Break the loop when true.
        $.each( $nodes, function ( i, node ) {

            return true !== nodeSearch.verifyNode( i, $( node ) ) ? true : false;

        } );

        if ( ! nodeSearch.locationFound ) {
            return false;
        }

        nodeSearch.markValidNodes();
        nodeSearch.setLastPosition();

        return {
            '$insertBefore': nodeSearch.$insertBefore,
            'disableFloat': nodeSearch.disableFloat
        };

    }

    /**
     * Search prototype used for determining insertion points.
     *
     * @param  {Object} options
     */
    function NodeSearch( options ) {

        this.totalHeight = 0;
        this.marginDifference = 40;
        this.inserted = [];
        this.$insertBefore = null;
        this.disableFloat = false;
        this.locationFound = false;
        this.validHeight = 0;
        this.exitLoop = false;
        this.height = options.height;
        this.force = options.force;
        this.limit = options.limit;
        this.$nodes = options.$nodes;
        this.lastPosition = 0;
        this.neededheight = options.height + this.marginDifference;

    }

    /**
     * Store the position of the last ad.
     */
    NodeSearch.prototype.setLastPosition = function () {

        this.lastPosition = this.$insertBefore.offset().top + this.neededheight;

    };

    /**
     * Mark nodes where insertion is valid.
     *
     * @todo  Consistently use `.attr()` or `.data()` when setting.
     *        jQuery does not need the DOM to change for data attributes.
     */
    NodeSearch.prototype.markValidNodes = function () {

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
     * @todo   Why is `this.exitLoop` set to `null`?
     * @todo   Document each step. Simplify if possible.
     *
     * @return {Boolean}
     */
    NodeSearch.prototype.verifyNode = function ( index, $node ) {

        // Avg outerHeight to negate overlapping margins
        var height = ( ( $node.outerHeight( true ) + $node.outerHeight() ) / 2 ),
            isLast = ( this.$nodes.length - 1 ) === index;

        this.totalHeight += height;

        if ( this.force && ( this.totalHeight >= this.limit || isLast ) ) {

            this.$insertBefore = $node;
            this.disableFloat = true;
            this.locationFound = true;
            this.exitLoop = true;

        } else if ( this.limit && ( this.totalHeight >= this.limit || isLast ) ) {

            this.locationFound = false;
            this.exitLoop = true;

        } else if ( isValidInsertionLocation( $node ) ) {

            this.validHeight += height;
            this.inserted.push( $node );

            if ( this.$insertBefore === null ) {
                this.$insertBefore = $node;
            }

            if ( this.validHeight >= this.neededheight ) {

                this.locationFound = true;
                this.exitLoop = true;

            }

        } else {

            this.validHeight = 0;
            this.$insertBefore = null;
            this.exitLoop = null;

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