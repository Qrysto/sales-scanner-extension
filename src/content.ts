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
        const items = data.items;
        if (!items?.length) {
          console.error('[ANA] No items found. items:', items, 'data:', data);
          return resClone;
        }

        const scanDom = () => {
          const searchResultEl = document.querySelector(
            '.shopee-search-item-result__items'
          );
          if (!searchResultEl) {
            setTimeout(scanDom, 500);
            return;
          }

          const itemEls = searchResultEl.querySelectorAll(
            '.shopee-search-item-result__item'
          );
          // Check whether lazy loading is done
          for (const itemEl of itemEls) {
            const aEl = itemEl.querySelector('a');
            if (!aEl) {
              setTimeout(scanDom, 500);
              return;
            }
          }

          addTableStyling();
          scanItemsDOM(searchResultEl, items);
        };
        scanDom(); // first scan
      }
    } catch (err) {
      console.log('Error fetch', err);
    } finally {
      return resClone;
    }
  };
})();

const isItemMatched = (() => {
  const urlParams = new URLSearchParams(window.location.search);
  const rawKeyword = urlParams.get('keyword');
  const keyword = rawKeyword && decodeURIComponent(rawKeyword).toLowerCase();

  return (item: ShopeeItem) =>
    !!keyword && item.item_basic.name.toLowerCase().includes(keyword);
})();

function scanItemsDOM(searchResultEl: Element, items: ShopeeItem[]) {
  const itemEls = searchResultEl.querySelectorAll(
    '.shopee-search-item-result__item'
  );
  const includedItems: ItemDescriptor[] = [];

  for (const itemEl of itemEls) {
    // Find item object
    const findSimilarEl = itemEl.querySelector(
      'a[href^="/find_similar_products"]'
    );
    const href = findSimilarEl?.getAttribute('href');
    if (!href) {
      console.log('[ANA] href not found. itemEl:', itemEl);
      continue;
    }
    const qIndex = href.indexOf('?');
    const query = href.substring(qIndex + 1);
    const params = new URLSearchParams(query);
    const id = params.get('itemid');
    const item = id && items.find((item) => String(item.itemid) === id);
    if (!item) {
      console.error('[ANA] item not found. qIndex:', qIndex, 'id:', id);
      continue;
    }
    const matched = isItemMatched(item);

    // Create item descriptor
    const linkEl = itemEl.querySelector('a.contents');
    const url = `https://shopee.vn${linkEl?.getAttribute('href') || ''}`;
    const imageUrl = `https://down-vn.img.susercontent.com/file/${item.item_basic.image}_tn.webp`;
    const itemDesc: ItemDescriptor = {
      item,
      url,
      imageUrl,
    };
    if (matched) {
      includedItems.push(itemDesc);
    }

    // Find background element
    itemEl.setAttribute('style', 'margin-bottom: 60px');
    const bgEl = itemEl.querySelector('a.contents > div');
    if (!bgEl) {
      console.error('[ANA] bgEl not found');
      continue;
    }
    if (matched) {
      bgEl.setAttribute(
        'style',
        'background-color:rgb(19, 95, 171) !important;'
      );
    }

    // Define functions
    const setBtnAsRemove = () => {
      btnEl.innerHTML = 'Remove';
      btnEl.addEventListener('click', removeItem);
      btnEl.removeEventListener('click', addItem);
    };
    const setBtnAsAdd = () => {
      btnEl.innerHTML = 'Add';
      btnEl.addEventListener('click', addItem);
      btnEl.removeEventListener('click', removeItem);
    };
    const addItem = () => {
      bgEl.setAttribute(
        'style',
        'background-color:rgb(19, 95, 171) !important;'
      );
      setBtnAsRemove();
      includedItems.push(itemDesc);
      displayTable(includedItems);
    };
    const removeItem = () => {
      bgEl.removeAttribute('style');
      setBtnAsAdd();
      const index = includedItems.findIndex(
        ({ item: { itemid } }) => itemid === item.itemid
      );
      if (index > -1) {
        includedItems.splice(index, 1);
        displayTable(includedItems);
      } else {
        console.error(
          '[ANA] Cannot find item. item:',
          item,
          'includedItems:',
          includedItems
        );
      }
    };

    // Manipulate item UI
    const addedEl = document.createElement('div');
    addedEl.setAttribute(
      'style',
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px'
    );
    itemEl.prepend(addedEl);

    const btnEl = document.createElement('button');
    if (matched) {
      setBtnAsRemove();
    } else {
      setBtnAsAdd();
    }
    btnEl.setAttribute(
      'style',
      'padding: 5px 8px; border-radius: 2px; border: 1px solid #bbb'
    );
    addedEl.appendChild(btnEl);

    const soldCountEl = document.createElement('div');
    const { sold, historical_sold, global_sold_count } = item.item_basic;
    soldCountEl.innerText = `${global_sold_count}`;
    addedEl.appendChild(soldCountEl);
  }

  // Display result table after all items are scanned
  displayTable(includedItems);
}

function displayTable(itemDescs: ItemDescriptor[]) {
  let tableDivEl = document.querySelector('#ana-result-table');
  if (tableDivEl) {
    tableDivEl.innerHTML = '';
  } else {
    const footerEl = document.querySelector('footer');
    const parent = footerEl?.parentElement;
    tableDivEl = document.createElement('div');
    tableDivEl.id = 'ana-result-table';
    parent?.insertBefore(tableDivEl, footerEl);
  }

  const tableEl = document.createElement('table');
  tableDivEl.appendChild(tableEl);
  tableEl.innerHTML = `
      <thead>
        <tr>
          <th>Ảnh</th>
          <th>Tên sản phảm</th>
          <th>Người bán</th>
          <th>Nguồn</th>
          <th>Doanh số</th>
        </tr>
      </thead>
    `;

  const tbodyEl = document.createElement('tbody');
  tableEl.appendChild(tbodyEl);

  for (const desc of itemDescs) {
    const {
      item: { item_basic },
      url,
      imageUrl,
    } = desc;
    const trEl = document.createElement('tr');
    tbodyEl.appendChild(trEl);
    trEl.innerHTML = `
        <td><img src="${imageUrl}" width="80" height="80" alt="${item_basic.name}"></td>
        <td>${item_basic.name}</td>
        <td>${item_basic.shop_name}</td>
        <td><a href="${url}">Shopee</a></td>
        <td>${item_basic.global_sold_count}</td>
      `;
  }

  const total = itemDescs.reduce(
    (total, desc) => total + (desc.item.item_basic.global_sold_count || 0),
    0
  );
  const totalEl = document.createElement('div');
  tableDivEl.appendChild(totalEl);
  totalEl.innerHTML = `Số sản phẩm: <strong>${itemDescs.length}</strong>, Tổng doanh số: <strong>${total}</strong>`;
  totalEl.setAttribute('style', 'text-align: right; margin: 20px 0;');
}

function addTableStyling() {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    #ana-result-table {
      width: 90%;
      max-with: 1500px;
      margin: 30px auto;
    }
    #ana-result-table table {
      width: 100%;
      border-collapse: collapse;
    }
    #ana-result-table th, #ana-result-table td {
      border: 1px solid #ddd;
      padding: 5px 8px;
    }
    #ana-result-table th {
      background-color: #f2f2f2;
    }
  `;
  document.head.appendChild(styleEl);
}

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

interface ItemDescriptor {
  item: ShopeeItem;
  url: string;
  imageUrl: string;
}
