const { onRequest } = require("firebase-functions/v2/https");
  const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions");

const TWELVE_DATA_API_KEY = defineSecret("TWELVE_DATA_API_KEY");

setGlobalOptions({
  maxInstances:3
})
const priceCache = new Map();
const CACHE_TIME_MS = 55 * 1000;
const MAX_ASSETS = 20;

async function fetchJson(url, apiKey) {
    const response = await fetch(url, {
        headers: {
            Authorization: `apikey ${apiKey}`
        }
    });

    if (!response.ok) {
        throw new Error(`Provider HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "error" || data.code) {
        throw new Error(data.message || "Market data request failed");
    }

    return data;
}

async function getRateToINR(currency, apiKey) {
    if (currency === "INR") {
        return 1;
    }

    const cacheKey = `FX:${currency}/INR`;
    const cached = priceCache.get(cacheKey);

    if (cached && Date.now() - cached.time < CACHE_TIME_MS) {
        return cached.value;
    }

    const url = new URL("https://api.twelvedata.com/exchange_rate");
    url.searchParams.set("symbol", `${currency}/INR`);

    const data = await fetchJson(url, apiKey);
    const rate = Number(data.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid exchange rate for ${currency}/INR`);
    }

    priceCache.set(cacheKey, {
        value: rate,
        time: Date.now()
    });

    return rate;
}

async function getAssetPrice(asset, apiKey) {
    const symbol = String(asset.symbol || "").trim().toUpperCase();
    const currency = String(asset.currency || "USD").trim().toUpperCase();

    if (!/^[A-Z0-9./:_-]{1,30}$/.test(symbol)) {
        throw new Error("Invalid asset symbol");
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error("Currency must be a 3-letter code");
    }

    const cacheKey = `PRICE:${symbol}:${currency}`;
    const cached = priceCache.get(cacheKey);

    if (cached && Date.now() - cached.time < CACHE_TIME_MS) {
        return { ...cached.value, cached: true };
    }

    const url = new URL("https://api.twelvedata.com/price");
    url.searchParams.set("symbol", symbol);

    const data = await fetchJson(url, apiKey);
    const marketPrice = Number(data.price);

    if (!Number.isFinite(marketPrice) || marketPrice < 0) {
        throw new Error(`Invalid market price for ${symbol}`);
    }

    const exchangeRate = await getRateToINR(currency, apiKey);

    const result = {
        symbol,
        currency,
        marketPrice,
        exchangeRate,
        priceINR: marketPrice * exchangeRate,
        updatedAt: new Date().toISOString()
    };

    priceCache.set(cacheKey, {
        value: result,
        time: Date.now()
    });

    return { ...result, cached: false };
}

exports.getAssetPrices = onRequest(
    {
        region: "asia-south1",
        secrets: [TWELVE_DATA_API_KEY],
        timeoutSeconds: 30,
        memory: "256MiB",
        cors: true
    },
    async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).json({
                error: "Use POST for this endpoint"
            });
        }

        const assets = req.body?.assets;

        if (!Array.isArray(assets) || assets.length === 0) {
            return res.status(400).json({
                error: "Send a non-empty assets array"
            });
        }

        if (assets.length > MAX_ASSETS) {
            return res.status(400).json({
                error: `Maximum ${MAX_ASSETS} assets per request`
            });
        }

        try {
            const apiKey = TWELVE_DATA_API_KEY.value();

            const results = await Promise.all(
                assets.map(async (asset) => {
                    try {
                        const quote = await getAssetPrice(asset, apiKey);
                        return { ok: true, ...quote };
                    } catch (error) {
                        return {
                            ok: false,
                            symbol: String(asset?.symbol || ""),
                            error: error.message
                        };
                    }
                })
            );

            return res.status(200).json({
                updatedAt: new Date().toISOString(),
                results
            });
        } catch (error) {
            console.error("Asset price request failed:", error.message);

            return res.status(500).json({
                error: "Unable to retrieve prices right now"
            });
        }
    }
);