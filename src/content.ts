console.log('[ANA] sales-scanner EXTENSION STARTS');

// (function () {
//   const XHR = XMLHttpRequest.prototype;
//   const openOrig = XHR.open;
//   const sendOrig = XHR.send;

//   XHR.open = function (method, url) {
//     console.log('Open', method, url);

//     const thisUrl = typeof url === 'string' ? url : url.hostname;
//     if (
//       thisUrl.startsWith('https://shopee.vn/api/v4/search/search_items') &&
//       method.toUpperCase() === 'GET'
//     ) {
//       (this as any)._isShopeeSearchResult = true;
//     }

//     return openOrig.apply(this, arguments as any);
//   };

//   XHR.send = function () {
//     this.addEventListener('load', function () {
//       console.log('Load', this);

//       if ((this as any)._isShopeeSearchResult) {
//         if (this.responseText) {
//           try {
//             // here you get RESPONSE TEXT (BODY), in JSON format, so you can use JSON.parse
//             const arr = this.responseText;
//             console.log('Response', this.responseText);
//           } catch (err) {
//             console.log('Error in responseType try catch');
//             console.log(err);
//           }
//         }
//       }
//     });

//     return sendOrig.apply(this, arguments as any);
//   };
// })();

/**
 * Overwrites fetch function to get Shopee search results
 */
(function () {
  const fetchOrig = fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const res = await fetchOrig(input, init);
    // Need to clone response, or calling res.json() again will throw this error:
    // `Failed to execute 'json' on 'Response': body stream already read`
    const resClone = res.clone();
    try {
      const url =
        typeof input === 'string'
          ? input
          : 'hostname' in input
          ? input.hostname
          : input.url;
      if (url.startsWith('https://shopee.vn/api/v4/search/search_items')) {
        const data: ShopeeSearchResult = await res.json();
        const items = filterItems(data.items);
        if (!items?.length) {
          console.error('[ANA] No items found. items:', items, 'data:', data);
          return resClone;
        }

        const intervalId = setInterval(() => {
          const searchResultEl = document.querySelector(
            '.shopee-search-item-result__items'
          );

          if (searchResultEl) {
            clearInterval(intervalId);
            highlightItems(searchResultEl, items);
          }
        }, 100);
      }
    } catch (err) {
      console.log('Error fetch', err);
    } finally {
      return resClone;
    }
  };
})();

function filterItems(items: ShopeeItem[]) {
  const urlParams = new URLSearchParams(window.location.search);
  const rawKeyword = urlParams.get('keyword');
  if (!rawKeyword) return null;
  const keyword = decodeURIComponent(rawKeyword).toLowerCase();
  if (!keyword) return null;

  return items.filter((item) =>
    item.item_basic.name.toLowerCase().includes(keyword)
  );
}

function highlightItems(searchResultEl: Element, items: ShopeeItem[]) {
  const itemEls = searchResultEl.querySelectorAll(
    '.shopee-search-item-result__item'
  );
  for (const itemEl of itemEls) {
    const findSimilarEl = itemEl.querySelector(
      'a[href^="/find_similar_products"]'
    );
    const href = findSimilarEl?.getAttribute('href');
    if (!href) continue;
    const qIndex = href.indexOf('?');
    const query = href.substring(qIndex + 1);
    const params = new URLSearchParams(query);
    const id = params.get('itemid');
    if (!id) continue;
    const item = items.find((item) => String(item.itemid) === id);

    const bgEl = itemEl.querySelector('a.contents > div');
    if (!bgEl) continue;

    const addedEl = document.createElement('div');
    addedEl.setAttribute(
      'style',
      'padding: 5px 8px; display: flex; justify-content: space-between'
    );
    bgEl.appendChild(addedEl);

    if (item) {
      bgEl.setAttribute(
        'style',
        'background-color:rgb(19, 95, 171) !important;'
      );

      const btnEl = document.createElement('button');
      btnEl.innerText = 'Remove';
      addedEl.appendChild(btnEl);

      const soldCountEl = document.createElement('div');
      const { sold, historical_sold, global_sold_count } = item.item_basic;
      soldCountEl.innerText = `${sold} | ${historical_sold} | ${global_sold_count}`;
      addedEl.appendChild(soldCountEl);
    } else {
      const btnEl = document.createElement('button');
      btnEl.innerText = 'Add';
      addedEl.appendChild(btnEl);
    }
  }
}

function addChild(parentEl: Element, childHtml: string) {}

interface TierVariation {
  name: string;
  options: string[];
  images: string[] | null;
  properties: any[];
  type: number;
}

interface ItemRating {
  rating_star?: number;
  rating_count?: number[];
  rcount_with_context?: number;
  rcount_with_image: number;
}

interface ItemBasic {
  itemid: number;
  shopid: number;
  name: string;
  label_ids: number[];
  image: string;
  images: string[];
  currency: string;
  stock: number;
  status: number;
  ctime: number;
  sold: number;
  historical_sold: number;
  liked: boolean;
  liked_count: number;
  view_count: null;
  catid: number;
  brand: string;
  cmt_count: number;
  flag: number;
  cb_option: number;
  item_status: string;
  price: number;
  price_min: number;
  price_max: number;
  price_min_before_discount: number;
  price_max_before_discount: number;
  hidden_price_display: null;
  price_before_discount: number;
  has_lowest_price_guarantee: boolean;
  show_discount: number;
  raw_discount: number;
  discount: string | null;
  is_category_failed: null;
  size_chart: null;
  video_info_list: any[] | null;
  tier_variations: TierVariation[];
  item_rating: ItemRating;
  is_lowest_price: boolean;
  shop_name?: string;
  shop_location?: string;
  global_sold_count?: number;
}

interface TrackingInfo {
  viral_spu_tracking: null;
  business_tracking: null;
  multi_search_tracking: null;
  groupid: null;
  ruleid: number[];
}

interface ItemConfig {
  disable_image_to_pdp: boolean;
  disable_model_id_to_pdp?: boolean;
}

interface ShopeeItem {
  item_basic: ItemBasic;
  adsid: null;
  campaignid: null;
  distance: null;
  match_type: null;
  ads_keyword: null;
  deduction_info: null;
  collection_id: null;
  display_name: null;
  campaign_stock: null;
  json_data: string;
  tracking_info: TrackingInfo;
  itemid: number;
  shopid: number;
  algo_image: null;
  fe_flags: null;
  item_type: number;
  foody_item: null;
  search_item_tracking: string;
  bff_item_tracking: string;
  personalized_labels: null;
  biz_json: string;
  creative_image_id: null;
  creative_id: null;
  creative_id_int: null;
  item_card_label_groups: null;
  title_max_lines: null;
  play_icon_ui_type: number;
  item_card_bottom_element: null;
  video_card: null;
  live_card: null;
  item_card_element_collection: null;
  item_card_price: null;
  display_ad_tag: null;
  traffic_source: number;
  live_card_item: null;
  live_card_rcmd_label: null;
  item_card_displayed_asset: null;
  item_data: null;
  ads_data_tms: string;
  item_config: ItemConfig;
  ctx_item_type: number;
  real_items: null;
  v_model_id: null;
  video_card_item: null;
  shop: null;
  creator: null;
  ad_voucher_signature: null;
  debug_info: null;
}

interface ShopeeSearchResult {
  items: ShopeeItem[];
}
