// Image pools. Photos are served from Unsplash (free to use under the Unsplash License) and are
// purely illustrative. Every <Img> falls back to a generated illustration if a photo fails to load,
// so the app stays fully usable offline or on networks that block the image CDN.

export const unsplash = (id: string, w = 640) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

const pool = (ids: string[]) => ids.map((id) => unsplash(id))

export const IMG = {
  burger: pool([
    '1568901346375-23c9450c58cd', '1550547660-d9450f859349', '1571091718767-18b5b1457add',
    '1553979459-d2229ba7433b', '1586190848861-99aa4a171e90', '1594212699903-ec8a3eca50f5',
    '1551782450-a2132b4ba21d', '1606755962773-d324e0a13086',
  ]),
  pizza: pool([
    '1565299624946-b28f40a0ae38', '1513104890138-7c749659a591', '1574071318508-1cdbab80d002',
    '1594007654729-407eedc4be65', '1604068549290-dea0e4a305ca', '1593560708920-61dd98c46a4e',
    '1628840042765-356cda07504e', '1599974579688-8dbdd335c77f',
  ]),
  biriyani: pool([
    '1563379091339-03b21ab4a4f8', '1589302168068-964664d93dc0', '1633945274405-b6c8069047b0',
    '1631515243349-e0cb75fb8d3a', '1610057099443-fde8c4d50f91',
  ]),
  curry: pool([
    '1585937421612-70a008356fbe', '1565557623262-b51c2513a641', '1631452180519-c014fe946bc7',
    '1588166524941-3bf61a9c41db', '1599487488170-d11ec9c172f0',
  ]),
  grill: pool([
    '1555939594-58d7cb561ad1', '1529692236671-f1f6cf9683ba', '1544025162-d76694265947',
    '1603360946369-dc9bb6258143', '1606851094291-6efae152bb87',
  ]),
  chinese: pool([
    '1585032226651-759b368d7246', '1603133872878-684f208fb84b', '1512058564366-18510be2db19',
    '1552611052-33e04de081de', '1612929633738-8fe44f7ec841', '1525755662778-989d0524087e',
    '1496116218417-1a781b1c416c', '1563245372-f21724e3856d',
  ]),
  chicken: pool([
    '1626645738196-c2a7c87a8f58', '1562967914-608f82629710', '1598103442097-8b74394b95c6',
    '1608039829572-78524f79c4c7', '1527477396000-e27163b481c2', '1567188040759-fb8a883dc6d8',
    '1606728035253-49e8a23146de',
  ]),
  fries: pool(['1573080496219-bb080dd4f877', '1576107232684-1279f390859f', '1630384060421-cb20d0e0649d']),
  snacks: pool([
    '1601050690597-df0568f70950', '1606491956689-2ea866880c84', '1528735602780-2552fd46c7af',
    '1550317138-10000687a72b', '1529006557810-274b9b2fc783', '1561651823-34feb02250e4',
  ]),
  ramen: pool(['1569718212165-3a8278d5f624', '1617093727343-374698b1b08d', '1534422298391-e4f8c172dddb']),
  desserts: pool([
    '1578985545062-69928b1d9587', '1551024601-bec78aea704b', '1563805042-7684c019e1cb',
    '1488477181946-6428a0291777', '1565958011703-44f9829ba187', '1571877227200-a0d98ea607e9',
    '1497034825429-c343d7c6a68f', '1501443762994-82bd5dace89a', '1551024506-0bccd828d307',
    '1558961363-fa8fdf82db35', '1606313564200-e75d5e30476c',
  ]),
  drinks: pool([
    '1544145945-f90425340c7e', '1546173159-315724a31696', '1556679343-c7306c1976bc',
    '1600271886742-f049cd451bba', '1572490122747-3968b75cc699', '1579954115545-a95591f28bfc',
    '1513558161293-cdaf765ed2fd', '1622483767028-3f66f32aef97',
  ]),
  coffee: pool([
    '1509042239860-f550ce710b93', '1495474472287-4d71bcdd2085', '1461023058943-07fcbe16d735',
    '1484723091739-30a097e8f929', '1482049016688-2d3e1b311543',
  ]),
  healthy: pool([
    '1540189549336-e6e99c3679fe', '1546069901-ba9599a7e63c', '1512621776951-a57141f2eefd',
    '1504674900247-0877df9cc836', '1476224203421-9ac39bcb3327',
  ]),
  pasta: pool(['1473093295043-cdd812d0e601', '1621996346565-e3dbc646d9a9', '1555949258-eb67b1ef0ceb', '1551183053-bf91a1d81141']),
  restaurant: pool([
    '1517248135467-4c7edcad34c4', '1414235077428-338989a2e8c0', '1552566626-52f8b828add9',
    '1559339352-11d035aa65de', '1514933651103-005eec06c04b', '1555396273-367ea4eb4db5',
    '1466978913421-dad2ebd01d17', '1504754524776-8f4f37790ca0',
  ]),
  // ---- Shopping ----
  tshirt: pool([
    '1521572163474-6864f9cf17ab', '1503341504253-dff4815485f1', '1576566588028-4147f3842f27',
    '1583743814966-8936f5b7be1a', '1622445275463-afa2ab738c34',
  ]),
  hoodie: pool(['1556821840-3a63f95609a7', '1620799140408-edc6dcb6d633']),
  jacket: pool(['1551028719-00167b16eac5', '1591047139829-d91aecb6caea', '1548126032-079a0fb0099d']),
  jeans: pool(['1542272604-787c3835535d', '1541099649105-f69ad21f3246', '1473966968600-fa801b869a1a']),
  shirt: pool([
    '1602810318383-e386cc2a3ccf', '1596755094514-f87e34085b2c', '1598033129183-c4f50c736f10',
    '1586790170083-2f9ceadc732d',
  ]),
  dress: pool([
    '1595777457583-95e059d581b8', '1572804013309-59a88b7e92f1', '1515372039744-b8f02a3ae446',
    '1496747611176-843222e1e57c', '1594633312681-425c7b97ccd1', '1610030469983-98e550d6193c',
  ]),
  sneakers: pool([
    '1549298916-b41d501d3772', '1600185365483-26d7a4cc7519', '1595950653106-6c9ebd614d3a',
    '1525966222134-fcfa99b8ae77', '1560769629-975ec94e6a86', '1491553895911-0055eca6402d',
    '1608231387042-66d1773070a5',
  ]),
  formalShoes: pool(['1614252235316-8c857d38b5f4', '1533867617858-e7b97e060509', '1614253429340-98120bd6d753', '1638247025967-b4e38f787b76']),
  heels: pool(['1543163521-1bf539c55dd2', '1515347619252-60a4bf4fff4f', '1603808033192-082d6919d3e1']),
  bags: pool([
    '1548036328-c9fa89d128fa', '1584917865442-de89df76afd3', '1553062407-98eeb64c6a62',
    '1622560480605-d83c853bc5c3', '1627123424574-724758594e93',
  ]),
  watches: pool(['1523275335684-37898b6baf30', '1524592094714-0f0654e20314', '1522312346375-d1a52e2b99b3', '1546868871-7041f2a55e12']),
  eyewear: pool(['1572635196237-14b3f281503f', '1511499767150-a48a237f0083']),
  jewelry: pool(['1611591437281-460bfbe1220a', '1535632066927-ab7c9ab60908']),
  caps: pool(['1588850561407-ed78c282e89b', '1576871337622-98d48d1cf531']),
  lifestyle: pool([
    '1505740420928-5e560c06d30e', '1608043152269-423dbba4e7e1', '1602143407151-7111542de6e8',
    '1514228742587-6b1558fcca3d', '1608571423902-eed4a5ad8108', '1571781926291-c477ebfd024b',
    '1556228578-8c89e6adf883', '1541643600914-78b084683601', '1592945403244-b3fbafd7f539',
  ]),
  fashionHero: pool(['1441986300917-64674bd600d8', '1445205170230-053b83016050', '1483985988355-763728e1935b', '1490481651871-ab68de25d43d']),
}

export type ImagePool = keyof typeof IMG

/** Deterministically pick from a pool (wraps around). */
export const pick = (p: ImagePool, i: number) => IMG[p][((i % IMG[p].length) + IMG[p].length) % IMG[p].length]

/** Emoji + hue used by the generated fallback illustration. */
export const FALLBACK_ART: Record<string, { emoji: string; hue: number }> = {
  burger: { emoji: '🍔', hue: 28 },
  pizza: { emoji: '🍕', hue: 12 },
  kacchi: { emoji: '🍛', hue: 38 },
  biriyani: { emoji: '🍛', hue: 40 },
  bangladeshi: { emoji: '🍚', hue: 45 },
  chinese: { emoji: '🥡', hue: 0 },
  chicken: { emoji: '🍗', hue: 30 },
  desserts: { emoji: '🍰', hue: 330 },
  snacks: { emoji: '🥟', hue: 48 },
  drinks: { emoji: '🧋', hue: 190 },
  coffee: { emoji: '☕', hue: 25 },
  grill: { emoji: '🍢', hue: 15 },
  indian: { emoji: '🍲', hue: 20 },
  healthy: { emoji: '🥗', hue: 120 },
  japanese: { emoji: '🍜', hue: 350 },
  arabian: { emoji: '🌯', hue: 35 },
  restaurant: { emoji: '🍽️', hue: 265 },
  men: { emoji: '👕', hue: 215 },
  women: { emoji: '👗', hue: 320 },
  shoes: { emoji: '👟', hue: 200 },
  bags: { emoji: '👜', hue: 30 },
  accessories: { emoji: '⌚', hue: 260 },
  streetwear: { emoji: '🧢', hue: 280 },
  lifestyle: { emoji: '🎧', hue: 170 },
  default: { emoji: '✨', hue: 265 },
}
