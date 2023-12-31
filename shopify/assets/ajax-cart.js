
  /*============================================================================
  (c) Copyright 2014 Shopify Inc. Author: Carson Shold (@cshold). All Rights Reserved.

  Plugin Documentation - http://shopify.github.io/Timber/#ajax-cart

  Ajaxify the add to cart experience and flip the button for inline confirmation,
  show the cart in a modal, or a 3D drawer.

  This file includes:
  - Basic Shopify Ajax API calls
  - Ajaxify plugin

  This requires:
  - jQuery 1.8+
  - handlebars.min.js (for cart template)
  - modernizer.min.js
  - snippet/ajax-cart-template.liquid


  JQUERY API (c) Copyright 2009-2014 Shopify Inc. Author: Caroline Schnapp. All Rights Reserved.
  Includes slight modifications to addItemFromForm.
  ==============================================================================*/
  if ((typeof Shopify) === 'undefined') { Shopify = {}; }

  /*============================================================================
  API Helper Functions
  ==============================================================================*/
  function isEmpty(obj) {

      // null and undefined are "empty"
      if (obj == null) return true;

      // Assume if it has a length property with a non-zero value
      // that that property is correct.
      if (obj.length > 0)    return false;
      if (obj.length === 0)  return true;

      // If it isn't an object at this point
      // it is empty, but it can't be anything *but* empty
      // Is it empty?  Depends on your application.
      if (typeof obj !== "object") return true;

      // Otherwise, does it have any properties of its own?
      // Note that this doesn't handle
      // toString and valueOf enumeration bugs in IE < 9
      for (var key in obj) {
          if (hasOwnProperty.call(obj, key)) return false;
      }

      return true;
  }

  function floatToString(numeric, decimals) {
  	var amount = numeric.toFixed(decimals).toString();
  	if(amount.match(/^\.\d+/)) {return "0"+amount; }
  	else { return amount; }
  };
  function attributeToString(attribute) {
  	if ((typeof attribute) !== 'string') {
  		attribute += '';
  		if (attribute === 'undefined') {
  			attribute = '';
  		}
  	}
  	return jQuery.trim(attribute);
  }
  function getCookie(c_name) {
  	var c_value = document.cookie;
  	var c_start = c_value.indexOf(" " + c_name + "=");
  	if (c_start == -1) {
  		c_start = c_value.indexOf(c_name + "=");
  	}
  	if (c_start == -1) {
  		c_value = null;
  	}
  	else {
  		c_start = c_value.indexOf("=", c_start) + 1;
  		var c_end = c_value.indexOf(";", c_start);
  		if (c_end == -1) {
  			c_end = c_value.length;
  		}
  		c_value = unescape(c_value.substring(c_start,c_end));
  	}
  	return c_value;
  }


	/*============================================================================
API Functions
==============================================================================*/
Shopify.formatMoney = function(cents, format) {

	if (typeof cents == 'string') cents = cents.replace('.','');
	var value = '';
	var patt = /\{\{\s*(\w+)\s*\}\}/;
	var formatString = (format || this.money_format);

	function addCommas(moneyString) {
		return moneyString.replace(/(\d+)(\d{3}[\.,]?)/,'$1,$2');
	}

	switch(formatString.match(patt)[1]) {
	case 'amount':
		value = addCommas(floatToString(cents/100.0, 2));
		break;
	case 'amount_no_decimals':
		value = addCommas(floatToString(cents/100.0, 0));
		break;
	case 'amount_with_comma_separator':
		value = floatToString(cents/100.0, 2).replace(/\./, ',');
		break;
	case 'amount_no_decimals_with_comma_separator':
		value = addCommas(floatToString(cents/100.0, 0)).replace(/\./, ',');
		break;
	}
	return formatString.replace(patt, value);
};

Shopify.onProduct = function(product) {
	// alert('Received everything we ever wanted to know about ' + product.title);
};

Shopify.onCartUpdate = function(cart) {
	// alert('There are now ' + cart.item_count + ' items in the cart.');
};

Shopify.updateCartNote = function(note, callback) {
	var params = {
		type: 'POST',
		url: '/cart/update.js',
		data: 'note=' + attributeToString(note),
		dataType: 'json',
		success: function(cart) {
			if ((typeof callback) === 'function') {
				callback(cart);
			}
			else {
				Shopify.onCartUpdate(cart);
			}
		},
		error: function(XMLHttpRequest, textStatus) {
			Shopify.onError(XMLHttpRequest, textStatus);
		}
	};
	jQuery.ajax(params);
};

Shopify.onError = function(XMLHttpRequest, textStatus, variant_id) {
		var data = eval('(' + XMLHttpRequest.responseText + ')');
	let customDataDescription = data.description,
		productTitle = '',
		variantSelector = document.querySelector('.add-to-cart .variant-selector[data-variant-id="' + variant_id + '"]');
	//console.log('variantSelector',variantSelector.closest('.information'),'are in your cart',data.description.includes('are in your cart'));
	if ((variantSelector != null || variantSelector.closest('.information') != null) && data.description.includes('are in your cart') == true) {
		productTitle = variantSelector.closest('.information').querySelector('.title a').innerHTML;
		customDataDescription = 'All available ' + productTitle + ' are in your cart.';
	}
	//console.log('customDataDescription',customDataDescription,'productTitle',productTitle);
	let addToCartMessagePopup = $('.reveal.add-to-cart-message');
	if (addToCartMessagePopup.length == 0) {
		addToCartMessagePopup = $("<div class='reveal add-to-cart-message' style='border:3px solid #000;' data-reveal><button class='close-button' data-close aria-label='Close modal' type='button'><span aria-hidden='true'>&times;</span></button><div class='message text-center' style='text-transform:capitalize;'></div></div>");
		if (addToCartMessagePopup.length > 0) {
			$('body').append(addToCartMessagePopup);
			new Foundation.Reveal(addToCartMessagePopup);
			addToCartMessagePopup.find('.message').html(customDataDescription);
			addToCartMessagePopup.foundation('open');
		} else {
			if (!!data.message) {
				alert(data.message + '(' + data.status  + '): ' + data.description);
			} else {
				alert('Error : ' + Shopify.fullMessagesFromErrors(data).join('; ') + '.');
			}
		}
	} else {
		addToCartMessagePopup.find('.message').html(customDataDescription);
		addToCartMessagePopup.foundation('open');
	}
};


/*============================================================================
POST to cart/add.js returns the JSON of the line item
- Allow use of form element instead of id
- Allow custom error callback
==============================================================================*/
Shopify.addItemFromForm = function(form, callback, errorCallback) {
	var params = {
		type: 'POST',
		url: '/cart/add.js',
		data: jQuery(form).serialize(),
		dataType: 'json',
		success: function(line_item) {
			if ((typeof callback) === 'function') {
				callback(line_item, form);
			}
			else {
				Shopify.onItemAdded(line_item, form);
			}
		},
		error: function(XMLHttpRequest, textStatus) {
			if ((typeof errorCallback) === 'function') {
				errorCallback(XMLHttpRequest, textStatus);
			}
			else {
				Shopify.onError(XMLHttpRequest, textStatus);
			}
		}
	};
	jQuery.ajax(params);
};

// Get from cart.js returns the cart in JSON
Shopify.getCart = function(callback) {
	jQuery.getJSON('/cart.js', function (cart, textStatus) {
		if ((typeof callback) === 'function') {
			callback(cart);
		}
		else {
			Shopify.onCartUpdate(cart);
		}
	});
};

// GET products/<product-handle>.js returns the product in JSON
Shopify.getProduct = function(handle, callback) {
	jQuery.getJSON('/products/' + handle + '.js', function (product, textStatus) {
		if ((typeof callback) === 'function') {
			callback(product);
		}
		else {
			Shopify.onProduct(product);
		}
	});
};

// POST to cart/change.js returns the cart in JSON
Shopify.changeItem = function(variant_id, quantity, callback) {
	var params = {
		type: 'POST',
		url: '/cart/change.js',
		data:  'quantity='+quantity+'&id='+variant_id,
		dataType: 'json',
		success: function(cart) {
			if ((typeof callback) === 'function') {
				callback(cart);
			}
			else {
				Shopify.onCartUpdate(cart);
			}
		},
		error: function(XMLHttpRequest, textStatus) {
			Shopify.onError(XMLHttpRequest, textStatus);
		}
	};
	jQuery.ajax(params);
};

// POST to cart/update.js returns the cart in JSON
Shopify.updateBYOB = function(variant_ids, callback) {
	var params = {
		type: 'POST',
		url: '/cart/update.js',
		data:  variant_ids,
		dataType: 'json',
		success: function(cart) {
			if ((typeof callback) === 'function') {
				callback(cart);
			}
			else {
				Shopify.onCartUpdate(cart);
			}
		},
		error: function(XMLHttpRequest, textStatus) {
			Shopify.onError(XMLHttpRequest, textStatus);
		}
	};
	jQuery.ajax(params);
};


/*============================================================================
Ajaxify Shopify Add To Cart
==============================================================================*/
var ajaxifyShopify = (function (module, $) {

	'use strict';

	// Public functions
	var init, cartUpdateCallback;

	// Private general variables
	var settings, cartInit, $drawerHeight, $cssTransforms, $cssTransforms3d, $nojQueryLoad, $w, $body, $html;

	// Private plugin variables
	var $formContainer, $btnClass, $wrapperClass, $addToCart, $flipClose, $flipCart, $flipContainer, $cartCountSelector, $cartCostSelector, $toggleCartButton, $modal, $cartContainer, $drawerCaret, $modalContainer, $modalOverlay, $closeCart, $drawerContainer, $prependDrawerTo, $callbackData = {};

	// Private functions
	var updateCountPrice, flipSetup, revertFlipButton, modalSetup, showModal, sizeModal, hideModal, drawerSetup, showDrawer, hideDrawer, sizeDrawer, loadCartImages, formOverride, itemAddedCallback, itemErrorCallback,setToggleButtons, flipCartUpdateCallback, buildCart, cartTemplate, adjustCart, adjustCartCallback, createQtySelectors, qtySelectors, scrollTop, toggleCallback;

	/*============================================================================
	Initialise the plugin and define global options
	==============================================================================*/
	init = function (options) {

		// Default settings
		settings = {
			method: 'drawer', // Method options are drawer, modal, and flip. Default is drawer.
			formSelector: 'form[action^="/cart/add"]',
			addToCartSelector: 'input[type="submit"]',
			cartCountSelector: null,
			cartCostSelector: null,
			toggleCartButton: null,
			btnClass: null,
			wrapperClass: null,
			useCartTemplate: false,
			moneyFormat: '${{amount}}',
			disableAjaxCart: false,
			enableQtySelectors: true,
			prependDrawerTo: 'body',
			onToggleCallback: null
		};

		// Override defaults with arguments
		$.extend(settings, options);

		// Make sure method is lower case
		settings.method = settings.method.toLowerCase();

		// Select DOM elements
		$formContainer = $(settings.formSelector);
		$btnClass = settings.btnClass;
		$wrapperClass = settings.wrapperClass;
		$addToCart = $formContainer.find(settings.addToCartSelector);
		$flipContainer = null;
		$flipClose = null;
		$cartCountSelector = $(settings.cartCountSelector);
		$cartCostSelector = $(settings.cartCostSelector);
		$toggleCartButton = $(settings.toggleCartButton);
		$modal = null;
		$prependDrawerTo = $(settings.prependDrawerTo);

		// CSS Checks
		$cssTransforms = Modernizr.csstransforms;
		$cssTransforms3d = Modernizr.csstransforms3d;

		// General Selectors
		$w = $(window);
		$body = $('body');
		$html = $('html');

		// Check if we can use .load
		$nojQueryLoad = $html.hasClass('lt-ie9');
		if ($nojQueryLoad) {
			settings.useCartTemplate = false;
		}

		// Setup ajax quantity selectors on the any template if enableQtySelectors is true
		if (settings.enableQtySelectors) {
			qtySelectors();
		}

		// Enable the ajax cart
		if (!settings.disableAjaxCart) {
			// Handle each case add to cart method
			switch (settings.method) {
				case 'flip':
					flipSetup();
					break;

				case 'modal':
					modalSetup();
					break;

				case 'drawer':
					drawerSetup();
					break;
			}

			// Escape key closes cart
			$(document).keyup(function (evt) {
				if (evt.keyCode == 27) {
					switch (settings.method) {
						case 'flip':
						case 'drawer':
							hideDrawer();
							break;
						case 'modal':
							hideModal();
							break;
					}
				}
			});

			if ($addToCart.length) {
				// Take over the add to cart form submit
				formOverride();
			}
		}

		// Run this function in case we're using the quantity selector outside of the cart
		adjustCart();
	};

	updateCountPrice = function (cart) {
		if ($cartCountSelector) {
			let cartItemSize = 0,
					cartItemBYOB = false,
					itemsBYOBIds = [];
			cart.items.forEach((cartItem, index) => {
				let productBYOB = false;
				if (cartItem.properties !== null) {
					for (const [key, value] of Object.entries(cartItem.properties)) {
						if (key === '_bundle_id') {
							if (itemsBYOBIds.includes(value) == false) {
								itemsBYOBIds.push(value);
							}
							productBYOB = true;
							cartItemBYOB = true;
							break;
						}
					}
				}
				if (productBYOB == false) {
					cartItemSize = cartItemSize + cartItem.quantity;
				}
			});
			if (cartItemBYOB == true) {
				cartItemSize = cartItemSize + itemsBYOBIds.length;
			}
			$cartCountSelector.html(cartItemSize).removeClass('hidden-count');

			if (cart.item_count === 0) {
				$cartCountSelector.addClass('hidden-count');
			}
		}
		if ($cartCostSelector) {
			$cartCostSelector.html(Shopify.formatMoney(cart.total_price, settings.moneyFormat));
		}
	};

	flipSetup = function () {
		// Build and append the drawer in the DOM
		drawerSetup();

		// Stop if there is no add to cart button
		if (!$addToCart.length) {
			return
		}

		// Wrap the add to cart button in a div
		$addToCart.addClass('flip-front').wrap('<div class="flip"></div>');

		// Write a (hidden) Checkout button, a loader, and the extra view cart button
		var checkoutBtn = $('<a href="/cart" class="flip-back" style="background-color: #C00; color: #fff;" id="flip-checkout">Checkout</a>').addClass($btnClass),
			flipLoader = $('<span class="ajaxifyCart-loader"></span>'),
			flipExtra = $('<div class="flip-extra">or <a href="#" class="flip-cart">View Cart (<span></span>)</a></div>');

		// Append checkout button and loader
		checkoutBtn.insertAfter($addToCart);
		flipLoader.insertAfter(checkoutBtn);

		// Setup new selectors
		$flipContainer = $('.flip');

		if (!$cssTransforms3d) {
			$flipContainer.addClass('no-transforms')
		}

		// Setup extra selectors once appended
		flipExtra.insertAfter($flipContainer);
		$flipCart = $('.flip-cart');

		$flipCart.on('click', function (e) {
			e.preventDefault();
			showDrawer(true);
		});

		// Reset the button if a user changes a variation
		$('input[type="checkbox"], input[type="radio"], select', $formContainer).on('click', function () {
			revertFlipButton();
		})
	};

	revertFlipButton = function () {
		$flipContainer.removeClass('is-flipped');
	};

	modalSetup = function () {
		// Create modal DOM elements with handlebars.js template
		var source = $("#modalTemplate").html(),
			template = Handlebars.compile(source);

		// Append modal and overlay to body
		$body.append(template).append('<div id="ajaxifyCart-overlay"></div>');

		// Modal selectors
		$modalContainer = $('#ajaxifyModal');
		$modalOverlay = $('#ajaxifyCart-overlay');
		$cartContainer = $('#ajaxifyCart');

		// Close modal when clicking the overlay
		$modalOverlay.on('click', hideModal);

		// Create a close modal button
		$modalContainer.prepend('<button class="ajaxifyCart--close" title="Close Cart">Close Cart</button>');
		$closeCart = $('.ajaxifyCart--close');
		$closeCart.on('click', hideModal);

		// Add a class if CSS translate isn't available
		if (!$cssTransforms) {
			$modalContainer.addClass('no-transforms')
		}

		// Update modal position on screen changes
		$(window).on({
			orientationchange: function (e) {
				if ($modalContainer.hasClass('is-visible')) {
					sizeModal('resize');
				}
			},
			resize: function (e) {
				// IE8 fires this when overflow on body is changed. Ignore IE8.
				if (!$nojQueryLoad && $modalContainer.hasClass('is-visible')) {
					sizeModal('resize');
				}
			}
		});

		// Toggle modal with cart button
		setToggleButtons();
	};

	showModal = function (toggle) {
		$body.addClass('ajaxify-modal--visible');
		// Build the cart if it isn't already there
		if (!cartInit && toggle) {
			Shopify.getCart(cartUpdateCallback);
		} else {
			sizeModal();
		}
	};

	sizeModal = function (isResizing) {
		if (!isResizing) {
			$modalContainer.css('opacity', 0);
		}

		// Position modal by negative margin
		$modalContainer.css({
			'margin-left': -($modalContainer.outerWidth() / 2),
			'opacity': 1
		});

		// Position close button relative to title
		$closeCart.css({
			'top': 10 + ($cartContainer.find('h1').height() / 2)
		})

		$modalContainer.addClass('is-visible');

		toggleCallback({
			'is_visible': true
		});
	};

	hideModal = function (e) {
		$body.removeClass('ajaxify-modal--visible');
		if (e) {
			e.preventDefault();
		}

		if ($modalContainer) {
			$modalContainer.removeClass('is-visible');
			$body.removeClass('ajaxify-lock');
		}

		toggleCallback({
			'is_visible': false
		});
	};

	drawerSetup = function () {
		// Create drawer DOM elements with handlebars.js template
		var source = $("#drawerTemplate").html(),
			template = Handlebars.compile(source),
			data = {
				wrapperClass: $wrapperClass
			};

		// Append drawer (defaults to body)
		$prependDrawerTo.prepend(template(data));

		// Drawer selectors
		$drawerContainer = $('#offCanvasRight');
		$cartContainer = $('#ajaxifyCart');
		$drawerCaret = $('.ajaxifyDrawer-caret > span');

		// Toggle drawer with cart button
		setToggleButtons();

		// Position caret and size drawer on resize if drawer is visible
		var timeout;
		$(window).resize(function () {
			clearTimeout(timeout);
			timeout = setTimeout(function () {
				if ($drawerContainer.hasClass('is-open')) {
					positionCaret();
				}
			}, 500);
		});

		// Position the caret the first time
		positionCaret();

		// Position the caret
		function positionCaret() {
			if ($toggleCartButton.offset()) {
				// Get the position of the toggle button to align the carat with
				var togglePos = $toggleCartButton.offset(),
					toggleWidth = $toggleCartButton.outerWidth(),
					toggleMiddle = togglePos.left + toggleWidth / 2;

				$drawerCaret.css('left', toggleMiddle + 'px');
			}
		}
	};

	showDrawer = function (toggle) {
		// If we're toggling with the flip method, use a special callback
		if (settings.method == 'flip') {
			Shopify.getCart(flipCartUpdateCallback);
		}
		// opening the drawer for the first time
		else if (!cartInit && toggle) {
			Shopify.getCart(cartUpdateCallback);
		}
		// simple toggle? just size it
		else if (cartInit && toggle) {}

		// Show the drawer
		$drawerContainer.addClass('is-open');
		$drawerContainer.removeClass('is-closed');
		$('.offCanvasRight.is-overlay-fixed').addClass('is-closable').addClass('is-visible');
		$('.off-canvas-content').addClass('is-open-right').addClass('has-transition-overlap').addClass('has-position-right');
		$('.off-canvas.position-right').attr('aria-hidden', 'false');
		toggleCallback({
			'is_visible': true
		});
	};

	hideDrawer = function () {
		$drawerContainer.removeAttr('style').removeClass('is-open');
		$('.offCanvasRight.is-overlay-fixed').removeClass('is-closable').removeClass('is-visible');
		$('.off-canvas-content').removeClass('is-open-right').removeClass('has-transition-overlap').removeClass('has-position-right');
		$('.off-canvas.position-right').attr('aria-hidden', 'true');
		toggleCallback({
			'is_visible': false
		});
	};

	// sizeDrawer = function ($empty) {
	//   if ($empty) {
	//   $drawerContainer.css('height', '0px');
	//  } else {
	//   $drawerHeight = $cartContainer.outerHeight();
	//  $drawerContainer.css('height',  $drawerHeight + 'px');
	// }
	//};

	loadCartImages = function () {
		// Size cart once all images are loaded
		var cartImages = $('img', $cartContainer),
			count = cartImages.length,
			index = 0;

		cartImages.on('load', function () {
			index++;

			if (index == count) {
				switch (settings.method) {
					case 'modal':
						sizeModal();
						break;
					case 'flip':
					case 'drawer':
						break;
				}
			}
		});
	};

	formOverride = function () {
		$formContainer.submit(function (e) {
			e.preventDefault();

			// Add class to be styled if desired
			$addToCart.removeClass('is-added').addClass('is-adding');

			// Remove any previous quantity errors
			$('.qty-error').remove();

			Shopify.addItemFromForm(e.target, itemAddedCallback, itemErrorCallback);

			// Set the flip button to a loading state
			switch (settings.method) {
				case 'flip':
					$flipContainer.addClass('flip--is-loading');
					break;
			}
		});
	};

	itemAddedCallback = function (product) {
		$addToCart.removeClass('is-adding').addClass('is-added');

		// Slight delay of flip to mimic a longer load
		switch (settings.method) {
			case 'flip':
				setTimeout(function () {
					$flipContainer.removeClass('flip--is-loading').addClass('is-flipped');
				}, 600);
				break;
		}
		Shopify.getCart(cartUpdateCallback);
	};

	itemErrorCallback = function (XMLHttpRequest, textStatus) {
		switch (settings.method) {
			case 'flip':
				$flipContainer.removeClass('flip--is-loading');
				break;
		}

		var data = eval('(' + XMLHttpRequest.responseText + ')');
		if (!!data.message) {
			if (data.status == 422) {
				$formContainer.after('<div class="errors qty-error">' + data.description + '</div>')
			}
		}
	};

	cartUpdateCallback = function (cart, show) {
	if (show === undefined) {
		show = true;
	}
		// Update quantity and price
		updateCountPrice(cart);

		switch (settings.method) {
			case 'flip':
				$('.flip-cart span').html(cart.item_count);
				break;
			case 'modal':
				buildCart(cart);
				break;
			case 'drawer':
				buildCart(cart);
				if (!$drawerContainer.hasClass('is-open') && show) {
					showDrawer();
				} else {}
				break;
		}
	};

	setToggleButtons = function (cart) {
		// Reselect the element in case it just loaded
		$toggleCartButton = $(settings.toggleCartButton);

		if ($toggleCartButton) {
			// Turn it off by default, in case it's initialized twice
			$toggleCartButton.off('click');

			// Toggle the cart, based on the method
			$toggleCartButton.on('click', function (e) {
				e.preventDefault();

				switch (settings.method) {
					case 'modal':
						if ($modalContainer.hasClass('is-visible')) {
							hideModal();
						} else {
							showModal(true);
						}
						break;
					case 'drawer':
					case 'flip':
						if ($drawerContainer.hasClass('is-open')) {
							hideDrawer();
						} else {
							showDrawer(true);
						}
						break;
				}

			});

		}
	};

	flipCartUpdateCallback = function (cart) {
		buildCart(cart);
	};

	buildCart = function (cart) {
		//--------------BOLD RO--------------
		if (typeof (BOLD) === 'object' && BOLD.helpers && typeof (BOLD.helpers.cleanCart) === 'function')
			cart = BOLD.helpers.cleanCart(cart);
		//--------------BOLD RO--------------
		// Empty cart if using default layout or not using the .load method to get /cart
		if (!settings.useCartTemplate || cart.item_count === 0) {
			$cartContainer.empty();
		}

		// Show empty cart
		if (cart.item_count === 0) {
			$cartContainer.append('<p class="center">Your bag is empty.</p>');

			switch (settings.method) {
				case 'modal':
					sizeModal('resize');
					break;
				case 'flip':
				case 'drawer':
					if (!$drawerContainer.hasClass('is-open') && cartInit) {

					}
					break;
			}
			return;
		}

		// Use the /cart template, or Handlebars.js layout based on theme settings
		if (settings.useCartTemplate) {
			cartTemplate(cart);
			return;
		}

		// Handlebars.js cart layout
		var items = [],
				itemsJson = {},
				item = {},
				data = {},
				itemsBYOBIds = [],
				itemsBYOB = [];

		var source = $("#cartTemplate").html(),
			template = Handlebars.compile(source);

		// Add each item to our handlebars.js data
		$.each(cart.items, function (index, cartItem) {
			var tags = '',
					preorderText = '',
					preorderMessage;
			if (itemsJson[cartItem.handle] == undefined) {
				$.ajax({
					'async': false,
					'type': "GET",
					'global': false,
					'dataType': 'JSON',
					'url': '/products/'+ cartItem.handle +'.json',
					'success': function (data) {
						tags = data.product.tags,
						preorderText = data.product.body_html.includes('<!-- back-order -->') ? data.product.body_html.split('<!-- back-order -->')[1].split('<!-- end back-order -->')[0] : '';
						itemsJson[cartItem.handle] = {};
						itemsJson[cartItem.handle]['tags'] = tags;
						itemsJson[cartItem.handle]['preorderText'] = preorderText;
					}
				})
			} else {
				tags = itemsJson[cartItem.handle]['tags'],
				preorderText = itemsJson[cartItem.handle]['preorderText'];
			}

			if (tags.includes('preorder')) {
				preorderMessage = preorderText != '' ? 'Preorder, will ship '+preorderText : 'Preorder, will ship when it becomes available'
			}
			else if (tags.includes('badge:final sale')) {
				preorderMessage = 'Final Sale'
			}

			var itemAdd = cartItem.quantity + 1,
				itemMinus = cartItem.quantity - 1,
				itemQty = cartItem.quantity + '';

			/* Hack to get product image thumbnail
			 *   - Remove file extension, add _small, and re-add extension
			 *   - Create server relative link
			 */
			var prodImg = cartItem.image.replace(/(\.[^.]*)$/, "_medium$1").replace('http:', '');
			var prodName = cartItem.title.replace(/(\-[^-]*)$/, "");
			var prodVariation = cartItem.title.replace(/^[^\-]*/, "").replace(/-/, "");
			var productBYOB = false;

			if (cartItem.properties !== null) {
				$.each(cartItem.properties, function(key, value) {
					if (key === '_bundle_id') {
						productBYOB = true;
						if (itemsBYOBIds.includes(value) == false) {
							itemsBYOBIds.push(value);
						}
					}
				});
			}

			// Create item's data object and add to 'items' array
			item = {
				id: cartItem.variant_id,
				url: cartItem.url,
				img: prodImg,
				name: prodName,
				variation: prodVariation,
				itemAdd: itemAdd,
				itemMinus: itemMinus,
				itemQty: itemQty,
				preorderMessage: preorderMessage,
				recurring: cartItem.formatted_recurring_desc,
				linePrice: Shopify.formatMoney(cartItem.line_price, settings.moneyFormat),
				originalLinePrice: Shopify.formatMoney(cartItem.original_line_price, settings.moneyFormat),
				discounts: cartItem.discounts,
				discountsApplied: cartItem.line_price === cartItem.original_line_price ? false : true
			};

			if (productBYOB == false) {
				items.push(item);
			}
		});

		itemsBYOBIds.forEach(bundleId => {
			let itemBYOB = [],
					itemBYOBSize = 0,
					itemBYOBPrice = 0,
					itemBYOBOriginalPrice = 0,
					itemBYOBDiscounts = [],
					itemBYOBDiscountsApplied = false,
					itemBYOBEdit = "",
					itemBYOBRemove = "",
					itemBYOBFinalSale = 0;
			$.each(cart.items, function (index, cartItem) {
				var productBYOB = false;
				if (cartItem.properties !== null) {
					$.each(cartItem.properties, function(key, value) {
						if (key === '_bundle_id' && value === bundleId) {
							productBYOB = true;
						}
					});
				}
				if (productBYOB == true) {
					var tags = '',
							preorderText = '',
							preorderMessage;
					if (itemsJson[cartItem.handle] == undefined) {
						$.ajax({
							'async': false,
							'type': "GET",
							'global': false,
							'dataType': 'JSON',
							'url': '/products/'+ cartItem.handle +'.json',
							'success': function (data) {
								tags = data.product.tags,
								preorderText = data.product.body_html.split('<!-- back-order -->')[1].split('<!-- end back-order -->')[0];
								itemsJson[cartItem.handle] = {
									tags: tags,
									preorderText: preorderText
								}
							}
						})
					} else {
						tags = itemsJson[cartItem.handle]['tags'],
						preorderText = itemsJson[cartItem.handle]['preorderText'];
					}

					if (tags.includes('preorder')) {
						preorderMessage = preorderText != '' ? 'Preorder, will ship '+preorderText : 'Preorder, will ship when it becomes available'
					}
					else if (tags.includes('badge:final sale')) {
						preorderMessage = 'Final Sale'
					}

					var itemAdd = cartItem.quantity + 1,
						itemMinus = cartItem.quantity - 1,
						itemQty = cartItem.quantity + '';

					/* Hack to get product image thumbnail
					 *   - Remove file extension, add _small, and re-add extension
					 *   - Create server relative link
					 */
					var prodImg = cartItem.image.replace(/(\.[^.]*)$/, "_medium$1").replace('http:', '');
					var prodName = cartItem.title.replace(/(\-[^-]*)$/, "");
					var prodVariation = cartItem.title.replace(/^[^\-]*/, "").replace(/-/, "");

					// Create item's data object and add to 'items' array
					item = {
						id: cartItem.variant_id,
						url: cartItem.url,
						img: prodImg,
						name: prodName,
						variation: prodVariation,
						itemAdd: itemAdd,
						itemMinus: itemMinus,
						itemQty: itemQty,
						preorderMessage: preorderMessage,
						recurring: cartItem.formatted_recurring_desc,
						linePrice: Shopify.formatMoney(cartItem.line_price, settings.moneyFormat),
						originalLinePrice: Shopify.formatMoney(cartItem.original_line_price, settings.moneyFormat),
						discounts: cartItem.discounts,
						discountsApplied: cartItem.line_price === cartItem.original_line_price ? false : true
					};

					if (itemBYOBEdit != "") { itemBYOBEdit = itemBYOBEdit + "-;-" }
					itemBYOBEdit = itemBYOBEdit + cartItem.key + "-:-" + cartItem.quantity;
					if (itemBYOBRemove != "") { itemBYOBRemove = itemBYOBRemove + "&" }
					itemBYOBRemove = itemBYOBRemove + "updates[" + cartItem.key + "]=0";
					itemBYOBSize = itemBYOBSize + cartItem.quantity;
					itemBYOBPrice = itemBYOBPrice + cartItem.line_price;
					itemBYOBOriginalPrice = itemBYOBOriginalPrice + cartItem.original_line_price;
					cartItem.discounts.forEach(discount => {
						let toShow = true;
						itemBYOBDiscounts.forEach(discountsBYOB => {
							if (discountsBYOB.title == discount.title) { toShow = false }
						});
						discount.show = toShow;
						itemBYOBDiscounts.push(discount);
					});
					itemBYOBDiscountsApplied = itemBYOBDiscountsApplied == true ? true : (cartItem.line_price === cartItem.original_line_price ? false : true);
					itemBYOB.push(item);
					if (preorderMessage == 'Final Sale') {
						itemBYOBFinalSale++;
					}
				}
			});
			if (itemBYOBFinalSale > 0) {
				if (itemBYOBFinalSale > 1) {
					itemBYOBFinalSale = itemBYOBFinalSale + ' items in your bundle are final sale';
				} else {
					itemBYOBFinalSale = itemBYOBFinalSale + ' ítem in your bundle is final sale';
				}
			} else {
				itemBYOBFinalSale = ''
			}
			if (itemBYOBSize > 0) {
				itemsBYOB.push({
					itemBYOB: itemBYOB,
					itemBYOBSize: itemBYOBSize,
					itemBYOBfound: itemBYOB.length > 0 ? true : false,
					itemBYOBimage: itemBYOBSize <= 3 ? bundleConfig.bundle_image_3 : (itemBYOBSize <= 4 ? bundleConfig.bundle_image_4 : bundleConfig.bundle_image_5),
					itemBYOBtext: bundleConfig.bundle_text,
					itemBYOBPrice: Shopify.formatMoney(itemBYOBPrice, settings.moneyFormat),
					itemBYOBOriginalPrice: Shopify.formatMoney(itemBYOBOriginalPrice, settings.moneyFormat),
					itemBYOBDiscounts: itemBYOBDiscounts,
					itemBYOBDiscountsApplied: itemBYOBDiscountsApplied,
					itemBYOBEdit: '/collections/build-your-bundle?edit-bundle=' + itemBYOBEdit,
					itemBYOBRemove: window.Shopify.routes.root + 'cart/update?' + itemBYOBRemove,
					itemBYOBRemoveIds: itemBYOBRemove,
					itemBYOBFinalSale: itemBYOBFinalSale
				});
			}
		});

		// Gather all cart data and add to DOM
		data = {
			items: items,
			totalPrice: Shopify.formatMoney(cart.total_price, settings.moneyFormat),
			btnClass: $btnClass,
			itemsBYOB: itemsBYOB
		}
		$cartContainer.append(template(data));

		// With new elements we need to relink the adjust cart functions
		adjustCart();

		// Setup close modal button and size drawer
		switch (settings.method) {
			case 'modal':
				loadCartImages();
				break;
			case 'flip':
			case 'drawer':
				if (cart.item_count > 0) {
					loadCartImages();
				} else {

				}
				break;
			default:
				break;
		}

		// Mark the cart as built
		cartInit = true;
	};

	cartTemplate = function (cart) {
		$cartContainer.load('/cart form[action="/cart"]', function () {

			// With new elements we need to relink the adjust cart functions
			adjustCart();

			// Size drawer at this point
			switch (settings.method) {
				case 'modal':
					loadCartImages();
					break;
				case 'flip':
				case 'drawer':
					if (cart.item_count > 0) {
						loadCartImages();
					} else {}
					break;
				default:
					break;
			}

			// Mark the cart as built
			cartInit = true;
		});
	}

	adjustCart = function () {
		// This function runs on load, and when the cart is reprinted

		// Create ajax friendly quantity fields and remove links in the ajax cart
		if (settings.useCartTemplate) {
			createQtySelectors();
		}

		// Update quantify selectors
		var qtyAdjust = $('.ajaxifyCart--qty span');

		// Add or remove from the quantity
		qtyAdjust.off('click');
		qtyAdjust.on('click', function () {
			var el = $(this),
				id = el.data('id'),
				qtySelector = el.siblings('.ajaxifyCart--num'),
				qty = parseInt(qtySelector.val());

			// Add or subtract from the current quantity
			if (el.hasClass('ajaxifyCart--add')) {
				qty = qty + 1;
			} else {
				qty = qty - 1;
				if (qty <= 0) qty = 0;
			}

			// If it has a data-id, update the cart.
			// Otherwise, just update the input's number
			if (id) {
				updateQuantity(id, qty);
			} else {
				qtySelector.val(qty);
			}

		});

		// Update quantity based on input on change
		var qtyInput = $('.ajaxifyCart--num');
		qtyInput.off('change');
		qtyInput.on('change', function () {
			var el = $(this),
				id = el.data('id'),
				qty = el.val();

			// Make sure we have a valid integer
			if ((parseFloat(qty) == parseInt(qty)) && !isNaN(qty)) {
				// We have a number!
			} else {
				// Not a number. Default to 1.
				el.val(1);
				return;
			}

			// Only update the cart via ajax if we have a variant ID to work with
			if (id) {
				updateQuantity(id, qty);
			}
		});

		// Highlight the text when focused
		qtyInput.off('focus');
		qtyInput.on('focus', function () {
			var el = $(this);
			setTimeout(function () {
				el.select();
			}, 50);
		});

		// Completely remove product
		$('.ajaxifyCart--remove').on('click', function (e) {
			var el = $(this),
				id = el.data('id') || null,
				qty = 0;

			// Without an id, let the default link action take over
			if (!id) {
				return;
			}

			e.preventDefault();
			updateQuantity(id, qty);
		});

		function updateQuantity(id, qty) {
			// Add activity classes when changing cart quantities
			if (!settings.useCartTemplate) {
				var row = $('.ajaxifyCart--product[data-id="' + id + '"]').addClass('ajaxifyCart--is-loading');
			} else {
				var row = $('.ajaxifyCart--product[data-id="' + id + '"]').addClass('ajaxifyCart--is-loading');
			}

			if (qty === 0) {
				row.addClass('is-removed');
			}

			// Slight delay to make sure removed animation is done
			setTimeout(function () {
				Shopify.changeItem(id, qty, adjustCartCallback);
			}, 250);
		}

		// Save note anytime it's changed
		var noteArea = $('textarea[name="note"]');
		noteArea.off('change');
		noteArea.on('change', function () {
			var newNote = $(this).val();

			// Simply updating the cart note in case they don't click update/checkout
			Shopify.updateCartNote(newNote, function (cart) {});
		});


		//Apple Pay support
		if (window.Shopify && Shopify.StorefrontExpressButtons) {
			Shopify.StorefrontExpressButtons.initialize();
		}

		// Completely remove product
		$('.ajaxifyCart--removeBundle').on('click', function (e) {
		var el = $(this),
			ids = el.data('ids') || null;

		// Without an id, let the default link action take over
		if (!ids) {
			return;
		}

		e.preventDefault();
		var row;
		// Add activity classes when changing cart quantities
		if (!settings.useCartTemplate) {
			row = $('.ajaxifyCart--product[data-id="' + ids + '"]').addClass('ajaxifyCart--is-loading');
		} else {
			row = $('.ajaxifyCart--product[data-id="' + ids + '"]').addClass('ajaxifyCart--is-loading');
		}

		row.addClass('is-removed');

		// Slight delay to make sure removed animation is done
		setTimeout(function () {
			Shopify.updateBYOB(ids, adjustCartCallback);
		}, 250);
	});
	};

	adjustCartCallback = function (cart) {
		// Update quantity and price
		updateCountPrice(cart);

		// Hide the modal or drawer if we're at 0 items
		if (cart.item_count === 0) {
			// Handle each add to cart method
			switch (settings.method) {
				case 'modal':
					break;
				case 'flip':
				case 'drawer':
					hideDrawer();
					break;
			}
		}

		// Reprint cart on short timeout so you don't see the content being removed
		setTimeout(function () {
			Shopify.getCart(buildCart);
		}, 150)
	};

	createQtySelectors = function () {
		// If there is a normal quantity number field in the ajax cart, replace it with our version
		if ($('input[type="number"]', $cartContainer).length) {
			$('input[type="number"]', $cartContainer).each(function () {
				var el = $(this),
					currentQty = el.val();

				var itemAdd = currentQty + 1,
					itemMinus = currentQty - 1,
					itemQty = currentQty + ' x';

				var source = $("#ajaxifyQty").html(),
					template = Handlebars.compile(source),
					data = {
						id: el.data('id'),
						itemQty: itemQty,
						itemAdd: itemAdd,
						itemMinus: itemMinus
					};

				// Append new quantity selector then remove original
				el.after(template(data)).remove();
			});
		}

		// If there is a regular link to remove an item, add attributes needed to ajaxify it
		if ($('a[href^="/cart/change"]', $cartContainer).length) {
			$('a[href^="/cart/change"]', $cartContainer).each(function () {
				var el = $(this).addClass('ajaxifyCart--remove');
			});
		}
	};

	qtySelectors = function () {
		// Change number inputs to JS ones, similar to ajax cart but without API integration.
		// Make sure to add the existing name and id to the new input element
		var numInputs = $('input[type="number"]');

		if (numInputs.length) {
			numInputs.each(function () {
				var el = $(this),
					currentQty = el.val(),
					inputName = el.attr('name'),
					inputId = el.attr('id');

				var itemAdd = currentQty + 1,
					itemMinus = currentQty - 1,
					itemQty = currentQty;

				var source = $("#jsQty").html(),
					template = Handlebars.compile(source),
					data = {
						id: el.data('id'),
						itemQty: itemQty,
						itemAdd: itemAdd,
						itemMinus: itemMinus,
						inputName: inputName,
						inputId: inputId
					};

				// Append new quantity selector then remove original
				el.after(template(data)).remove();
			});

			// Setup listeners to add/subtract from the input
			$('.js--qty-adjuster').on('click', function () {
				var el = $(this),
					id = el.data('id'),
					qtySelector = el.siblings('.js--num'),
					qty = parseInt(qtySelector.val());

				// Add or subtract from the current quantity
				if (el.hasClass('js--add')) {
					qty = qty + 1;
				} else {
					qty = qty - 1;
					if (qty <= 1) qty = 1;
				}

				// Update the input's number
				qtySelector.val(qty);
			});
		}
	};

	toggleCallback = function (data) {
		// Run the callback if it's a function
		if (typeof settings.onToggleCallback == 'function') {
			settings.onToggleCallback.call(this, data);
		}
	};

	module = {
		init: init,
		cartUpdateCallback: cartUpdateCallback
	};

	return module;

}(ajaxifyShopify || {}, jQuery));

/*============================================================================
POST to cart/add.js returns the JSON of the line item associated with the added item
==============================================================================*/
Shopify.addItem = function(variant_id, quantity, callback) {
	var quantity = quantity || 1;
	var params = {
			type: 'POST',
			url: '/cart/add.js',
			data: 'quantity=' + quantity + '&id=' + variant_id,
			dataType: 'json',
			success: function(cart) {
					if ((typeof callback) === 'function') {
							callback(cart);
					}
					else {
							setTimeout(() => {
									Shopify.getCart(ajaxifyShopify.cartUpdateCallback);
							}, 250);
					}
			},
			error: function(XMLHttpRequest, textStatus) {
					Shopify.onError(XMLHttpRequest, textStatus, variant_id);
			}
	};
	jQuery.ajax(params);
};
