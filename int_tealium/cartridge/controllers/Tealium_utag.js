/**
 * Tealium
 *
 * @module controllers/Tealium_utag
 */

var ISML = dw.template.ISML;
var productMgr = dw.catalog.ProductMgr;
var catalogMgr = dw.catalog.CatalogMgr;
var orderMgr = dw.order.OrderMgr;
var basketMgr = dw.order.BasketMgr;

// Shouldn't be needed, but here for someone who requested
var encodeHttpParameterMapFlag = false;

/*
 * This code below is invoked from Commerce Cloud footer.isml via URLUtils call to the "RenderTealium" function.
 *    
 *  <isinclude url="${URLUtils.url('Tealium_utag-RenderTealium',
 *   'title', request.pageMetaData.title,
 *   'pagecontexttype', ('pageContext' in this && !empty(pageContext)) ? ''+pageContext.type : null,
 *   'pagecontexttitle', ('pageContext' in this && !empty(pageContext)) ? ''+pageContext.title : null,
 *   'searchterm', request.httpParameterMap.q.stringValue,
 *   'searchresultscount', (!empty(pdict.ProductSearchResult) ? ''+pdict.ProductSearchResult.count : null),
 *   'productid', (!empty(pdict.Product) ? pdict.Product.ID : null),
 *   'pagecgid',  request.httpParameterMap.cgid.stringValue,
 *   'orderno', (!empty(pdict.Order) ? pdict.Order.orderNo : null)
 *  )}"/>
 *
 */

var RenderTealium = function() {

    var tealiumDataLayer = buildDataLayer();

    ISML.renderTemplate('tealium/tealium_utag', {
        tealiumDataLayer : JSON.stringify( tealiumDataLayer, null, "  " )
    });
}

var enc = function(a) {
	//  This changes the default JSON.stringify output of \" to &quot;
	if (encodeHttpParameterMapFlag){
		return dw.util.StringUtils.encodeString(""+ a, dw.util.StringUtils.ENCODE_TYPE_HTML);
	} 
	return a;
}

var getUnitPriceFromPriceModel = function( priceModel ) {
   var unitPrice;

   if ( priceModel.getPrice().getValue() != "0" ) {
       unitPrice = priceModel.getPrice().getValue();
   } else if ( priceModel.getMaxPrice().getValue() != "0" ) {
       unitPrice = priceModel.getMaxPrice().getValue();
   } else {
       unitPrice = priceModel.getMinPrice().getValue();
   }

   return unitPrice.toFixed(2);
}

var getProductCategoryFromProduct = function( product ) {
                
    var productCategory;

    if ( product.primaryCategory != null ) {
        productCategory = "" + product.primaryCategory.getID();
    } else if ( product.isMaster() == false && product.getVariationModel().master.primaryCategory != null ) {
        productCategory = product.getVariationModel().master.primaryCategory.getID(); 
    }
    return ""+productCategory;
}

var buildDataLayer = function() {
    var dl = {};
    var order;
    var pageCategoryId;
    var product, currentProduct, productId, productCategory, productPrimeCategory, productSet;
    var lineItem, priceValue, promotionID;
    var couponLineItems = null, productLineItems = null, priceAdjustments = null;
    var searchResultsCount;
    var customer, profile;
    var httpParameterMap = request.httpParameterMap;

    try {
        customer = request.getSession().getCustomer();
        // Setting to null when value is an empty string
        productId = ""+httpParameterMap.productid.value || null;
        pageCategoryId = ""+httpParameterMap.pagecgid.value || null;
        searchResultsCount = ""+httpParameterMap.searchresultscount.value || null;
        searchTerm = ""+httpParameterMap.searchterm.value || null;

        dl.page_name = httpParameterMap.title.value;
        dl.page_type = "content";
        dl.page_context_type = (""+enc(httpParameterMap.pagecontexttype)).toLowerCase();
        dl.page_context_title = (""+enc(httpParameterMap.pagecontexttitle)).toLowerCase();

        // Set customer data
        if ( customer != null ) {
	    dl.user_anonymous = "" + customer.isAnonymous();
	    dl.user_authenticated = "" + customer.isAuthenticated();
	    dl.user_registered = "" + customer.isRegistered();
	    dl.customer_id = "" + customer.getID();
	    profile = customer.getProfile();
            if ( profile != null ) {
                dl.customer_email =  profile.getEmail();
            }
        }
    
        if ( httpParameterMap.contentsearchresultscount.value != null && productId != null && pageCategoryId == null ) {
            dl.search_results = "" + enc(httpParameterMap.contentsearchresultscount.value);
            dl.page_type = "content search";
        }
    
        if ( searchResultsCount != null && productId == null && pageCategoryId == null ) {
            dl.search_results = enc(searchResultsCount);
            dl.page_type = "search";
        }
    
        if ( pageCategoryId != null && productId == null ) {
            dl.page_type = "category";
            dl.page_category = enc(pageCategoryId);
        }
    
        if ( searchTerm != null ){
	    dl.search_term = enc(searchTerm);
        }
    
        if ( productId != null ) {
            product = productMgr.getProduct(productId);
            if ( product != null ) {
                productCategory = "";
                dl.page_name = product.getName();
                if ( product.isProduct() ) {
                    dl.page_type = "product";
    
                    // Product values always an array, even when just one item in there
                    dl.product_id = ["" + product.getID()];
                    dl.product_sku = ["" + product.getManufacturerSKU()];
                    dl.product_name = ["" + product.getName()];
                    dl.product_brand = ["" + product.getBrand()];
                    dl.product_category = [getProductCategoryFromProduct( product )];
                    dl.product_unit_price = [getUnitPriceFromPriceModel( product.getPriceModel() )];
                } else {
                    // If not a product then it is a product set
                    // Example store product set page: /s/SiteGenesis/womens/clothing/outfits/spring-look.html?lang=default
                    productSet = product.getProductSetProducts();
                    dl.page_type = "product set";
                    dl.product_id = [];
                    dl.product_sku = [];
                    dl.product_name = [];
                    dl.product_brand = [];
                    dl.product_category = [];
                    dl.product_unit_price = [];
                    
                    for ( var index = 0; index < productSet.length; index += 1 ) {
                        currentProduct = productSet[index];
                        dl.product_id.push("" + currentProduct.getID());
                        dl.product_name.push("" + currentProduct.getName());	
                        dl.product_brand.push("" + currentProduct.getBrand());
                        dl.product_sku.push("" + currentProduct.getManufacturerSKU());
                        dl.product_category.push(getProductCategoryFromProduct( currentProduct));
                        dl.product_unit_price.push(getUnitPriceFromPriceModel( currentProduct.getPriceModel() ));
                    }
                }
            }
        }
    
        // We do not want to count a transaction for just a review of order history
        if ( !empty(httpParameterMap.orderno.value) && dl.page_context_type != "orderhistory" ) {
	    order = orderMgr.getOrder( httpParameterMap.orderno.value );
            couponLineItems = order.getCouponLineItems();
            productLineItems = order.getProductLineItems();
            priceAdjustments = order.getPriceAdjustments(); 
    
            dl.page_name = "confirmation";
            dl.page_type = "checkout";
            dl.order_id = "" + httpParameterMap.orderno;
            dl.order_discount = (order.getMerchandizeTotalNetPrice().getValue() - order.getAdjustedMerchandizeTotalNetPrice().getValue()).toFixed(2);
            dl.order_subtotal = order.getAdjustedMerchandizeTotalNetPrice().getValue().toFixed(2);
            dl.order_tax = ((order.getTotalTax())?order.getTotalTax().getValue().toFixed(2):"");
            dl.order_shipping = order.getAdjustedShippingTotalNetPrice().getValue().toFixed(2);
            dl.order_payment_type = (order.getPaymentInstruments().length>0)?order.getPaymentInstruments()[0].getPaymentMethod():"none";
            dl.order_total = (order.getAdjustedMerchandizeTotalGrossPrice().getValue() + order.getAdjustedShippingTotalNetPrice().getValue() + order.getShippingTotalTax().getValue()).toFixed(2);
            dl.order_currency = order.getCurrencyCode();
            dl.order_postal_code = "" + order.getBillingAddress().getPostalCode();
        }

        if ( (dl.page_context_type == "checkout" || dl.page_context_type == "cart") && productId == null ) {
	    var basket = basketMgr.getCurrentBasket();

            if ( basket != null ) {
                productLineItems = basket.getProductLineItems();

                if ( productLineItems != null ) {
                    dl.page_type = "checkout";
                    couponLineItems = basket.getCouponLineItems();
                    priceAdjustments = basket.getPriceAdjustments();
                }
            }
        }

	
        if ( couponLineItems != null && couponLineItems.length>0 ) {
            dl.coupon_codes = [];
            for ( var couponIndex = 0; couponIndex < couponLineItems.length; couponIndex += 1 ) {
                dl.coupon_codes.push(couponLineItems[couponIndex].getCouponCode());
            }
	}
	
	if ( priceAdjustments != null && priceAdjustments.length>0 ) {
            dl.order_coupon_discount = [];
            dl.order_coupon_promo = [];
            for ( var priceAdjustmentIndex = 0; priceAdjustmentIndex < priceAdjustments.length; priceAdjustmentIndex += 1 ) {
                if ( priceAdjustments[priceAdjustmentIndex].getPromotion() != null && priceAdjustments[priceAdjustmentIndex].getPromotion().getPromotionClass() == "ORDER" ) {
                    dl.order_coupon_discount.push( ""+priceAdjustments[priceAdjustmentIndex].getPriceValue() );
                    dl.order_coupon_promo.push( ""+priceAdjustments[priceAdjustmentIndex].getPromotionID() );
                }				
            }
        }

        if ( productLineItems != null && productLineItems.length>0 ) {
            dl.product_id = [];
            dl.product_sku = [];
            dl.product_name = [];
            dl.product_brand = [];
            dl.product_category = [];
            dl.product_unit_price = [];
            dl.product_quantity = [];
            dl.product_coupon_discount = [];
            dl.product_coupon_promo = [];
            for ( var itemIndex = 0; itemIndex < productLineItems.length; itemIndex += 1 ) {
                lineItem = productLineItems[itemIndex];
                currentProduct = lineItem.product;
                if ( currentProduct != null ) {
                    dl.product_id.push("" + currentProduct.getID());
                    dl.product_name.push("" + currentProduct.getName());	
                    dl.product_brand.push("" + currentProduct.getBrand());
                    dl.product_sku.push("" + lineItem.getManufacturerSKU());
                    dl.product_category.push(getProductCategoryFromProduct( currentProduct));
                    //dl.product_unit_price.push(getUnitPriceFromPriceModel( currentProduct.getPriceModel() ));
		    dl.product_unit_price.push("" + lineItem.getBasePrice().getValue().toFixed(2));
                    dl.product_quantity.push("" + lineItem.getQuantityValue());
                    priceAdjustments = lineItem.getPriceAdjustments();
	            if ( priceAdjustments != null && priceAdjustments.length>0 ) {
                        priceValue = 0;
                        promotionID = "";
                        for ( var priceAdjustmentIndex = 0; priceAdjustmentIndex < priceAdjustments.length; priceAdjustmentIndex += 1 ) {
                            if ( priceAdjustments[priceAdjustmentIndex].getPromotion() != null && priceAdjustments[priceAdjustmentIndex].getPromotion().getPromotionClass() != "ORDER" ) {
			   	if ( promotionID != "" ) {
			            promotionID += ",";
			    	}
                                priceValue += priceAdjustments[priceAdjustmentIndex].getPriceValue();
                                promotionID = promotionID + priceAdjustments[priceAdjustmentIndex].getPromotionID();
                            }
                        }
                        dl.product_coupon_discount.push("" + priceValue);
                        dl.product_coupon_promo.push(promotionID);
                    } else {
                       dl.product_coupon_discount.push("0");
                       dl.product_coupon_promo.push("");
                    }
                }
            }
        }

    } catch(e) { dl.debug_error = [e.message,e.lineNumber] }
    
    return dl
}

/*
 * Export
 */
RenderTealium.public = true;

module.exports = {
    RenderTealium: RenderTealium,
};

