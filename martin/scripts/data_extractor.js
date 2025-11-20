const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readText(p) {
    return fs.readFileSync(p, "utf8");
}
function readJson(p) {
    return JSON.parse(readText(p));
}
function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function resetDir(p) {
    if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
    }
    fs.mkdirSync(p, { recursive: true });
}
function writeJson(p, obj) {
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function toISODate(mdY) {
    if (!mdY) return null;
    const parts = mdY
        .trim()
        .split(/[\/\-]/)
        .map((s) => s.trim());
    if (parts.length < 3) return null;
    let [m, d, y] = parts;
    m = parseInt(m, 10);
    d = parseInt(d, 10);
    y = parseInt(y, 10);
    if (y < 100) {
        y = y >= 50 ? 1900 + y : 2000 + y;
    }
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
}

function parseCurrencyToNumber(text) {
    if (text == null) return null;
    const cleaned = String(text).replace(/[^0-9.\-]/g, "");
    if (cleaned === "") return null;
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    return Math.round(num * 100) / 100;
}

function titleCaseName(s) {
    if (s == null) return null;
    s = String(s).toLowerCase();
    return s.replace(
        /(^|[\s\-\'])([a-z])/g,
        (m, p1, p2) => p1 + p2.toUpperCase(),
    );
}

function getValueByStrong($, label) {
    let out = null;
    $("td > strong").each((i, el) => {
        const t = $(el).text().trim();
        if (t.toLowerCase() === String(label).toLowerCase()) {
            const td = $(el).parent();
            const clone = td.clone();
            clone.children("strong").remove();
            let text = clone.text().replace(/\s+/g, " ").trim();
            out = text;
            return false;
        }
    });
    return out;
}

function errorUnknownEnum(value, cls, prop) {
    const err = {
        type: "error",
        message: `Unknown enum value ${value}.`,
        path: `${cls}.${prop}`,
    };
    throw new Error(JSON.stringify(err));
}

function mapPropertyType(useCodeText, landUseCode) {
    if (!useCodeText && !landUseCode) return null;

    // Normalize the text
    const t = (useCodeText || "").toLowerCase();
    const code = (landUseCode || "").trim();

    // Check by land use code first (more precise)
    const codeMap = {
        // Vacant Residential
        "0000": "VacantLand",
        "0001": "VacantLand",
        "0004": "VacantLand",

        // Single Family
        "0100": "SingleFamily",
        "0110": "SingleFamily",
        "0120": "SingleFamily",
        "0130": "Townhouse",
        "0400R": "SingleFamily",

        // Duplex
        "0180": "Duplex",
        "0800": "Duplex",
        "0880": "Duplex",

        // Triplex & Quadruplex
        "0803": "3Units",
        "0804": "4Units",

        // Multi-family
        "0812": "MultiFamilyLessThan10",
        "0300": "MultiFamilyMoreThan10",

        // Mobile/Manufactured
        "0200": "ManufacturedHousing",
        "0400RM": "MobileHome",
        "2800": "MobileHome",

        // Street / right-of-way style parcels
        "8700": "LandParcel",

        // Condominiums
        "0400": "Condominium",
        "0482": "Condominium",
        "1204": "Condominium",
        "4804": "Condominium",
        "9149": "Condominium",
        "9449": "Condominium",
        "9549": "Condominium",
        "9749": "Condominium",

        // Timeshare
        "0403": "Timeshare",

        // Cooperative
        "0500": "Cooperative",

        // Retirement
        "0600": "Retirement",

        // Misc Residential
        "0700": "MiscellaneousResidential",

        // Common Areas
        "0900": "ResidentialCommonElementsAreas",
        "0182": "ResidentialCommonElementsAreas",
        "9709": "ResidentialCommonElementsAreas",
    };

    if (code && codeMap[code]) {
        return codeMap[code];
    }

    // Fallback to text-based matching
    if (t.includes("single family") || t.includes("single unit")) return "SingleFamily";
    if (t.includes("duplex") || t.includes("2 unit")) return "Duplex";
    if (t.includes("triplex") || t.includes("3 unit")) return "3Units";
    if (t.includes("quad") || t.includes("4 unit")) return "4Units";
    if (t.includes("condo")) return "Condominium";
    if (t.includes("town")) return "Townhouse";
    if (t.includes("cooperative") || t.includes("co-op")) return "Cooperative";
    if (t.includes("timeshare") || t.includes("time share")) return "Timeshare";
    if (t.includes("mobile home") || t.includes("mobilehome")) return "MobileHome";
    if (t.includes("manufactured") || t.includes("modular")) return "ManufacturedHousing";
    if (t.includes("retirement")) return "Retirement";
    if (t.includes("multi") && t.includes(">=10")) return "MultiFamilyMoreThan10";
    if (t.includes("multi") && t.includes("<10")) return "MultiFamilyLessThan10";
    if (t.includes("multi") || t.includes("apartment")) return "MultipleFamily";
    if (t.includes("vacant")) return "VacantLand";
    if (t.includes("common element") || t.includes("common area") || t.includes("rec area")) return "ResidentialCommonElementsAreas";
    if (t.includes("misc")) return "MiscellaneousResidential";

    return null;
}

function mapUnitsType(units) {
    if (units == null) return null;
    const u = parseInt(units, 10);
    if (isNaN(u) || u === 0) return null; // Handle 0 and invalid numbers
    if (u === 1) return "One";
    if (u === 2) return "Two";
    if (u === 3) return "Three";
    if (u === 4) return "Four";
    return null; // For 5+ units or other cases
}

function mapStreetSuffixType(suf) {
    if (!suf) return null;
    const m = {
        STREET: "St",
        ST: "St",
        AVENUE: "Ave",
        AVE: "Ave",
        BOULEVARD: "Blvd",
        BLVD: "Blvd",
        ROAD: "Rd",
        RD: "Rd",
        LANE: "Ln",
        LN: "Ln",
        DRIVE: "Dr",
        DR: "Dr",
        COURT: "Ct",
        CT: "Ct",
        PLACE: "Pl",
        PL: "Pl",
        TERRACE: "Ter",
        TER: "Ter",
        CIRCLE: "Cir",
        CIR: "Cir",
        WAY: "Way",
        LOOP: "Loop",
        PARKWAY: "Pkwy",
        PKWY: "Pkwy",
        PLAZA: "Plz",
        PLZ: "Plz",
        TRAIL: "Trl",
        TRL: "Trl",
        BEND: "Bnd",
        BND: "Bnd",
        CRESCENT: "Cres",
        CRES: "Cres",
        MANOR: "Mnr",
        MNR: "Mnr",
        SQUARE: "Sq",
        SQ: "Sq",
        CROSSING: "Xing",
        XING: "Xing",
        PATH: "Path",
        RUN: "Run",
        WALK: "Walk",
        ROW: "Row",
        ALLEY: "Aly",
        ALY: "Aly",
        BEACH: "Bch",
        BCH: "Bch",
        BRIDGE: "Br",
        BRG: "Br",
        BROOK: "Brk",
        BRK: "Brk",
        BROOKS: "Brks",
        BRKS: "Brks",
        BUG: "Bg",
        BG: "Bg",
        BUGS: "Bgs",
        BGS: "Bgs",
        CLUB: "Clb",
        CLB: "Clb",
        CLIFF: "Clf",
        CLF: "Clf",
        CLIFFS: "Clfs",
        CLFS: "Clfs",
        COMMON: "Cmn",
        CMN: "Cmn",
        COMMONS: "Cmns",
        CMNS: "Cmns",
        CORNER: "Cor",
        COR: "Cor",
        CORNERS: "Cors",
        CORS: "Cors",
        CREEK: "Crk",
        CRK: "Crk",
        COURSE: "Crse",
        CRSE: "Crse",
        CREST: "Crst",
        CRST: "Crst",
        CAUSEWAY: "Cswy",
        CSWY: "Cswy",
        COVE: "Cv",
        CV: "Cv",
        CANYON: "Cyn",
        CYN: "Cyn",
        DALE: "Dl",
        DL: "Dl",
        DAM: "Dm",
        DM: "Dm",
        DRIVES: "Drs",
        DRS: "Drs",
        DIVIDE: "Dv",
        DV: "Dv",
        ESTATE: "Est",
        EST: "Est",
        ESTATES: "Ests",
        ESTS: "Ests",
        EXPRESSWAY: "Expy",
        EXPY: "Expy",
        EXTENSION: "Ext",
        EXT: "Ext",
        EXTENSIONS: "Exts",
        EXTS: "Exts",
        FALL: "Fall",
        FALL: "Fall",
        FALLS: "Fls",
        FLS: "Fls",
        FLAT: "Flt",
        FLT: "Flt",
        FLATS: "Flts",
        FLTS: "Flts",
        FORD: "Frd",
        FRD: "Frd",
        FORDS: "Frds",
        FRDS: "Frds",
        FORGE: "Frg",
        FRG: "Frg",
        FORGES: "Frgs",
        FRGS: "Frgs",
        FORK: "Frk",
        FRK: "Frk",
        FORKS: "Frks",
        FRKS: "Frks",
        FOREST: "Frst",
        FRST: "Frst",
        FREEWAY: "Fwy",
        FWY: "Fwy",
        FIELD: "Fld",
        FLD: "Fld",
        FIELDS: "Flds",
        FLDS: "Flds",
        GARDEN: "Gdn",
        GDN: "Gdn",
        GARDENS: "Gdns",
        GDNS: "Gdns",
        GLEN: "Gln",
        GLN: "Gln",
        GLENS: "Glns",
        GLNS: "Glns",
        GREEN: "Grn",
        GRN: "Grn",
        GREENS: "Grns",
        GRNS: "Grns",
        GROVE: "Grv",
        GRV: "Grv",
        GROVES: "Grvs",
        GRVS: "Grvs",
        GATEWAY: "Gtwy",
        GTWY: "Gtwy",
        HARBOR: "Hbr",
        HBR: "Hbr",
        HARBORS: "Hbrs",
        HBRS: "Hbrs",
        HILL: "Hl",
        HL: "Hl",
        HILLS: "Hls",
        HLS: "Hls",
        HOLLOW: "Holw",
        HOLW: "Holw",
        HEIGHTS: "Hts",
        HTS: "Hts",
        HAVEN: "Hvn",
        HVN: "Hvn",
        HIGHWAY: "Hwy",
        HWY: "Hwy",
        INLET: "Inlt",
        INLT: "Inlt",
        ISLAND: "Is",
        IS: "Is",
        ISLANDS: "Iss",
        ISS: "Iss",
        ISLE: "Isle",
        SPUR: "Spur",
        JUNCTION: "Jct",
        JCT: "Jct",
        JUNCTIONS: "Jcts",
        JCTS: "Jcts",
        KNOLL: "Knl",
        KNL: "Knl",
        KNOLLS: "Knls",
        KNLS: "Knls",
        LOCK: "Lck",
        LCK: "Lck",
        LOCKS: "Lcks",
        LCKS: "Lcks",
        LODGE: "Ldg",
        LDG: "Ldg",
        LIGHT: "Lgt",
        LGT: "Lgt",
        LIGHTS: "Lgts",
        LGTS: "Lgts",
        LAKE: "Lk",
        LK: "Lk",
        LAKES: "Lks",
        LKS: "Lks",
        LANDING: "Lndg",
        LNDG: "Lndg",
        MALL: "Mall",
        MEWS: "Mews",
        MEADOW: "Mdw",
        MDW: "Mdw",
        MEADOWS: "Mdws",
        MDWS: "Mdws",
        MILL: "Ml",
        ML: "Ml",
        MILLS: "Mls",
        MLS: "Mls",
        MANORS: "Mnrs",
        MNRS: "Mnrs",
        MOUNT: "Mt",
        MT: "Mt",
        MOUNTAIN: "Mtn",
        MTN: "Mtn",
        MOUNTAINS: "Mtns",
        MTNS: "Mtns",
        OVERPASS: "Opas",
        OPAS: "Opas",
        ORCHARD: "Orch",
        ORCH: "Orch",
        OVAL: "Oval",
        PARK: "Park",
        PASS: "Pass",
        PIKE: "Pike",
        PLAIN: "Pln",
        PLN: "Pln",
        PLAINS: "Plns",
        PLNS: "Plns",
        PINE: "Pne",
        PNE: "Pne",
        PINES: "Pnes",
        PNES: "Pnes",
        PRAIRIE: "Pr",
        PR: "Pr",
        PORT: "Prt",
        PRT: "Prt",
        PORTS: "Prts",
        PRTS: "Prts",
        PASSAGE: "Psge",
        PSGE: "Psge",
        POINT: "Pt",
        PT: "Pt",
        POINTS: "Pts",
        PTS: "Pts",
        RADIAL: "Radl",
        RADL: "Radl",
        RAMP: "Ramp",
        REST: "Rst",
        RIDGE: "Rdg",
        RDG: "Rdg",
        RIDGES: "Rdgs",
        RDGS: "Rdgs",
        ROADS: "Rds",
        RDS: "Rds",
        RANCH: "Rnch",
        RNCH: "Rnch",
        RAPID: "Rpd",
        RPD: "Rpd",
        RAPIDS: "Rpds",
        RPDS: "Rpds",
        ROUTE: "Rte",
        RTE: "Rte",
        SHOAL: "Shl",
        SHL: "Shl",
        SHOALS: "Shls",
        SHLS: "Shls",
        SHORE: "Shr",
        SHR: "Shr",
        SHORES: "Shrs",
        SHRS: "Shrs",
        SKYWAY: "Skwy",
        SKWY: "Skwy",
        SUMMIT: "Smt",
        SMT: "Smt",
        SPRING: "Spg",
        SPG: "Spg",
        SPRINGS: "Spgs",
        SPGS: "Spgs",
        SQUARES: "Sqs",
        SQS: "Sqs",
        STATION: "Sta",
        STA: "Sta",
        STRAVENUE: "Stra",
        STRA: "Stra",
        STREAM: "Strm",
        STRM: "Strm",
        STREETS: "Sts",
        STS: "Sts",
        THROUGHWAY: "Trwy",
        TRWY: "Trwy",
        TRACE: "Trce",
        TRCE: "Trce",
        TRAFFICWAY: "Trfy",
        TRFY: "Trfy",
        TRAILER: "Trlr",
        TRLR: "Trlr",
        TUNNEL: "Tunl",
        TUNL: "Tunl",
        UNION: "Un",
        UN: "Un",
        UNIONS: "Uns",
        UNS: "Uns",
        UNDERPASS: "Upas",
        UPAS: "Upas",
        VIEW: "Vw",
        VIEWS: "Vws",
        VILLAGE: "Vlg",
        VLG: "Vlg",
        VILLAGES: "Vlgs",
        VLGS: "Vlgs",
        VALLEY: "Vl",
        VLY: "Vl",
        VALLEYS: "Vlys",
        VLYS: "Vlys",
        WAYS: "Ways",
        VIA: "Via",
        WELL: "Wl",
        WL: "Wl",
        WELLS: "Wls",
        WLS: "Wls",
        CROSSROAD: "Xrd",
        XRD: "Xrd",
        CROSSROADS: "Xrds",
        XRDS: "Xrds",
    }
    const key = String(suf).trim().toUpperCase();
    const v = m[key] || null;
    if (!v) {
        errorUnknownEnum(suf, "address", "street_suffix_type");
    }
    return v;
}

function mapDeedType(raw) {
    if (!raw) return null;
    const t = raw.trim().toLowerCase();

    // Warranty Deeds
    if (t === "warranty deed") return "Warranty Deed";
    if (t.includes("full covenant") && t.includes("warranty")) return "Warranty Deed";
    if (t.startsWith("wd ") && t.includes("warranty")) return "Warranty Deed";

    // Special Warranty Deed
    if (t === "special warranty deed") return "Special Warranty Deed";
    if (t.includes("special warranty")) return "Special Warranty Deed";

    // Quitclaim Deed
    if (t === "quitclaim deed") return "Quitclaim Deed";
    if (t === "qu" || t === "qc") return "Quitclaim Deed";
    if (t.startsWith("quit claim")) return "Quitclaim Deed";
    if (t.includes("quitclaim")) return "Quitclaim Deed";

    // Trustee's Deed
    if (t.includes("trustee") && t.includes("deed")) return "Trustee's Deed";
    if (t.includes("deed of reconveyance")) return "Trustee's Deed";
    if (t === "trustee's deed") return "Trustee's Deed";

    // Deed in Trust (often for estate planning - maps to Trust deed transfer)
    if (t === "deed in trust") return "Transfer on Death Deed";
    if (t.includes("deed in trust")) return "Transfer on Death Deed";

    if (t === "deed of reconveyance or trustee's deed") return "Trustee's Deed";
    if (t === "sw") return "Special Warranty Deed";

    // If not matched, return null (don't throw error)
    return null;
}

function mapRoofCovering(raw) {
    if (!raw) return null;
    const t = raw.toLowerCase();
    if (t.includes("comp sh")) return "3-Tab Asphalt Shingle";
    if (t.includes("3-tab")) return "3-Tab Asphalt Shingle";
    if (t.includes("arch")) return "Architectural Asphalt Shingle";
    return null;
}

function cleanNum(text) {
    if (text == null) return null;
    const only = String(text).replace(/[^0-9]/g, "");
    if (only === "") return null;
    return parseInt(only, 10);
}

function formatSquareFeet(value) {
    if (value == null) return null;
    const numeric = typeof value === "number" ? value : cleanNum(value);
    if (numeric == null) return null;
    if (numeric < 10) return null;
    return `${numeric} SF`;
}

function toNumberOrNull(value) {
    if (value == null || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseBookPage(raw) {
    if (!raw) return { book: null, page: null };
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned) return { book: null, page: null };
    const parts = cleaned.split(/[\/\-]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
        return { book: parts[0], page: parts[1] };
    }
    return { book: cleaned, page: null };
}

function main() {
    const inputHtmlPath = "input.html";
    const addrPath = "unnormalized_address.json";
    const seedPath = "property_seed.json";
    const ownersPath = path.join("owners", "owner_data.json");
    const utilsPath = path.join("owners", "utilities_data.json");
    const layoutPath = path.join("owners", "layout_data.json");

    const html = readText(inputHtmlPath);
    const $ = cheerio.load(html);
    const addr = readJson(addrPath);
    const seed = readJson(seedPath);
    const ownersData = readJson(ownersPath);
    const utilitiesData = readJson(utilsPath);
    const layoutData = readJson(layoutPath);

    resetDir("data");

    const addressFilename = "address.json";
    const propertyFilename = "property.json";
    const lotFilename = "lot.json";

    // Address
    const addressSource = addr || {};
    const canonicalRequestIdentifier =
        addressSource.request_identifier || seed.request_identifier || null;
    const fileRecords = [];
    function enqueueFileRecord(payload) {
        if (!payload || typeof payload !== "object") return;
        const trimmed = {};
        Object.entries(payload).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            if (typeof value === "string") {
                const v = value.trim();
                if (!v) return;
                trimmed[key] = v;
                return;
            }
            trimmed[key] = value;
        });
        if (!Object.keys(trimmed).length) return;
        const file = `file_${fileRecords.length + 1}.json`;
        fileRecords.push({ file, data: trimmed });
    }
    if (canonicalRequestIdentifier) {
        enqueueFileRecord({ request_identifier: canonicalRequestIdentifier });
    }
    const situsAddress = getValueByStrong($, "Situs Address");
    const rawAddress =
        addressSource.full_address ||
        addressSource.unnormalized_address ||
        situsAddress ||
        null;
    const normalizedAddressProvided = Boolean(
        addressSource.street_number ||
            addressSource.street_name ||
            addressSource.street_suffix_type ||
            addressSource.city_name ||
            addressSource.state_code ||
            addressSource.postal_code ||
            addressSource.unit_identifier,
    );
    const hasAddressRecord =
        normalizedAddressProvided || Boolean(rawAddress);
    let latitude = toNumberOrNull(addressSource.latitude);
    let longitude = toNumberOrNull(addressSource.longitude);
    if ((!latitude || !longitude) && $("a.property-google-maps").length) {
        const gmHref = $("a.property-google-maps").attr("href");
        if (gmHref) {
            const mm = gmHref.match(/viewpoint=([-0-9\.]+),([-0-9\.]+)/);
            if (mm) {
                if (!latitude) latitude = parseFloat(mm[1]);
                if (!longitude) longitude = parseFloat(mm[2]);
            }
        }
    }
    let addressOut = null;
    if (hasAddressRecord) {
        const countyName =
            addressSource.county_jurisdiction === "Martin"
                ? "Martin"
                : addressSource.county_jurisdiction ||
                  addressSource.county_name ||
                  null;
        const addressBase = {
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            county_name: countyName,
            country_code: addressSource.country_code || "US",
            request_identifier:
                addressSource.request_identifier ||
                seed.request_identifier ||
                null,
        };
        if (normalizedAddressProvided) {
            addressOut = {
                ...addressBase,
                street_number: addressSource.street_number ?? null,
                street_pre_directional_text:
                    addressSource.street_pre_directional_text ?? null,
                street_name: addressSource.street_name ?? null,
                street_suffix_type: addressSource.street_suffix_type ?? null,
                street_post_directional_text:
                    addressSource.street_post_directional_text ?? null,
                city_name: addressSource.city_name ?? null,
                state_code: addressSource.state_code ?? null,
                postal_code: addressSource.postal_code ?? null,
                plus_four_postal_code: addressSource.plus_four_postal_code ?? null,
                unit_identifier: addressSource.unit_identifier ?? null,
                route_number: addressSource.route_number ?? null,
                township: addressSource.township ?? null,
                range: addressSource.range ?? null,
                section: addressSource.section ?? null,
                block: addressSource.block ?? null,
                lot: addressSource.lot ?? null,
                municipality_name: addressSource.municipality_name ?? null,
            };
        } else {
            addressOut = {
                ...addressBase,
                unnormalized_address: rawAddress || null,
            };
        }
        Object.keys(addressOut).forEach((key) => {
            if (addressOut[key] === undefined) {
                delete addressOut[key];
            }
        });
        writeJson(path.join("data", addressFilename), addressOut);
    }
    const hasAddressFile = Boolean(addressOut);

    // Property
    const parcelId =
        getValueByStrong($, "Parcel ID") ||
        seed.parcel_id ||
        seed.parcelIdentifier ||
        null;
    const useCodeText = getValueByStrong($, "Use Code/Property Class") || "";
    let propertyUseCode = null;
    if (useCodeText) {
        const match = useCodeText.match(/-\s*(\d{4})/);
        if (match) {
            propertyUseCode = match[1];
        }
    }
    let propertyType = mapPropertyType(useCodeText, propertyUseCode);

    let livable =
        getValueByStrong($, "Total Finished Area") ||
        getValueByStrong($, "Finished Area") ||
        null;
    const yearBuiltText = getValueByStrong($, "Year Built");
    const yearBuilt = yearBuiltText
        ? parseInt(yearBuiltText.replace(/[^0-9]/g, ""), 10)
        : null;
    const numUnitsText = getValueByStrong($, "Number of Units");
    const numUnits = numUnitsText
        ? parseInt(numUnitsText.replace(/[^0-9]/g, ""), 10)
        : null;
    const unitsType = mapUnitsType(numUnits);

    // Full legal description without disclaimer
    let legalFull = null;
    const legalTd = $("div.table-section.full-legal-description td").first();
    if (legalTd && legalTd.length) {
        const clone = legalTd.clone();
        clone.find(".legal-disclaimer").remove();
        legalFull = clone.text().replace(/\s+/g, " ").trim();
    } else {
        const legalShort = getValueByStrong($, "Legal Description");
        legalFull = legalShort || null;
    }

    const neighborhood = getValueByStrong($, "Neighborhood");

    const legalAcresText = getValueByStrong($, "Legal Acres");
    let lotSizeAcre = legalAcresText
        ? parseFloat(legalAcresText.replace(/[^0-9.]/g, ""))
        : null;
    if (isNaN(lotSizeAcre)) lotSizeAcre = null;
    let lotAreaSqft = null;
    if (lotSizeAcre != null) {
        lotAreaSqft = Math.round(lotSizeAcre * 43560);
    }
    let lotType = null;
    if (lotSizeAcre != null) {
        lotType =
            lotSizeAcre <= 0.25
                ? "LessThanOrEqualToOneQuarterAcre"
                : "GreaterThanOneQuarterAcre";
    }

    const formattedLivable = formatSquareFeet(livable);
    if (!propertyType) {
        if (lotSizeAcre && lotSizeAcre > 0.25 && !formattedLivable) {
            propertyType = "LandParcel";
        } else {
            propertyType = "Building";
        }
    }
    const propertyOut = {
        parcel_identifier: parcelId,
        property_type: propertyType,
        property_structure_built_year: yearBuilt || null,
        property_effective_built_year: null,
        livable_floor_area: formattedLivable,
        area_under_air: formattedLivable,
        total_area: null,
        number_of_units: numUnits || null,
        number_of_units_type: unitsType,
        property_legal_description_text: legalFull || null,
        subdivision: neighborhood || null,
        zoning: null,
        historic_designation: undefined,
    };
    Object.keys(propertyOut).forEach((k) => {
        if (propertyOut[k] === undefined) delete propertyOut[k];
    });
    writeJson(path.join("data", propertyFilename), propertyOut);

    // Lot
    const lotOut = {
        lot_type: lotType || null,
        lot_length_feet: null,
        lot_width_feet: null,
        lot_area_sqft: lotAreaSqft || null,
        lot_size_acre: lotSizeAcre || null,
        landscaping_features: null,
        view: null,
        fencing_type: null,
        fence_height: null,
        fence_length: null,
        driveway_material: null,
        driveway_condition: null,
        lot_condition_issues: null,
    };
    writeJson(path.join("data", lotFilename), lotOut);

    // Taxes
    const taxes = [];
    const currentValueBlock = $("div.table-section.current-value");
    if (currentValueBlock.length) {
        const tds = currentValueBlock.find("td");
        const row = {};
        tds.each((i, td) => {
            const strong = $(td).find("strong").text().trim();
            const text = $(td).text().replace(strong, "").trim();
            if (strong) row[strong] = text;
        });
        const year = parseInt(row["Year"], 10);
        if (!isNaN(year)) {
            taxes.push({
                tax_year: year,
                property_land_amount: parseCurrencyToNumber(row["Land Value"]),
                property_building_amount: parseCurrencyToNumber(
                    row["Improvement Value"],
                ),
                property_market_value_amount: parseCurrencyToNumber(
                    row["Market Value"],
                ),
                property_assessed_value_amount: parseCurrencyToNumber(
                    row["Assessed Value"],
                ),
                property_taxable_value_amount: parseCurrencyToNumber(
                    row["County Taxable Value"],
                ),
                monthly_tax_amount: null,
                period_start_date: null,
                period_end_date: null,
                yearly_tax_amount: null,
            });
        }
    }
    $("div.value-history-table table tr").each((i, tr) => {
        if (i === 0) return;
        const $tr = $(tr);
        const tds = $tr.find("td");
        if (tds.length >= 8) {
            const year = parseInt($(tds[0]).text().trim(), 10);
            if (!isNaN(year)) {
                taxes.push({
                    tax_year: year,
                    property_land_amount: parseCurrencyToNumber($(tds[1]).text()),
                    property_building_amount: parseCurrencyToNumber($(tds[2]).text()),
                    property_market_value_amount: parseCurrencyToNumber($(tds[3]).text()),
                    property_assessed_value_amount: parseCurrencyToNumber(
                        $(tds[5]).text(),
                    ),
                    property_taxable_value_amount: parseCurrencyToNumber(
                        $(tds[7]).text(),
                    ),
                    monthly_tax_amount: null,
                    period_start_date: null,
                    period_end_date: null,
                    yearly_tax_amount: null,
                });
            }
        }
    });
    const seenYears = new Set();
    taxes.forEach((t) => {
        if (seenYears.has(t.tax_year)) return;
        seenYears.add(t.tax_year);
        writeJson(path.join("data", `tax_${t.tax_year}.json`), t);
    });

    // Sales / Deeds / Files
    const salesRows = [];
    $("div.sale-history-table table tr").each((i, tr) => {
        if (i === 0) return;
        const $tr = $(tr);
        const tds = $tr.find("td");
        if (tds.length >= 6) {
            const saleDate = $(tds[0]).text().trim();
            const priceTxt = $(tds[1]).text().trim();
            const grantor = $(tds[2]).text().trim();
            const deedTypeRaw = $(tds[3]).text().trim();
            const docNum = $(tds[4]).text().trim();
            const linkA = $(tds[5]).find("a");
            const bookPageText = linkA.text().trim();
            const link = linkA.attr("href") || null;
            salesRows.push({
                saleDate,
                priceTxt,
                grantor,
                deedTypeRaw,
                docNum,
                bookPageText,
                link,
            });
        }
    });

    const salesOut = [];
    const deedsOut = [];
    const propertySalesTargets = [];

    function addSaleRecord(propName, value) {
        if (!propName || value === undefined || value === null) return null;
        const file = `sales_history_${salesOut.length + 1}.json`;
        salesOut.push({ file, data: { [propName]: value } });
        propertySalesTargets.push(`./${file}`);
        return `./${file}`;
    }

    salesRows.forEach((row) => {
        const isoDate = toISODate(row.saleDate);
        const price = parseCurrencyToNumber(row.priceTxt);
        const deedType = row.deedTypeRaw ? mapDeedType(row.deedTypeRaw) : null;

        const saleDatePath = isoDate
            ? addSaleRecord("ownership_transfer_date", isoDate)
            : null;
        const salePricePath =
            price != null
                ? addSaleRecord("purchase_price_amount", price)
                : null;

        if (!saleDatePath && !salePricePath) {
            return;
        }

        if (!isoDate) {
            return;
        }

        const deedIndex = deedsOut.length + 1;
        const deedObj = {
            ownership_transfer_date: isoDate,
        };
        if (deedType) {
            deedObj.deed_type = deedType;
        }
        if (row.docNum) {
            deedObj.instrument_number = row.docNum;
        }
        const bookPage = parseBookPage(row.bookPageText);
        if (bookPage.book) deedObj.book = bookPage.book;
        if (bookPage.page) deedObj.page = bookPage.page;
        deedsOut.push({ file: `deed_${deedIndex}.json`, data: deedObj });
    });

    salesOut.forEach((s) => writeJson(path.join("data", s.file), s.data));
    deedsOut.forEach((d) => writeJson(path.join("data", d.file), d.data));
    fileRecords.forEach((f) => writeJson(path.join("data", f.file), f.data));

    // Owners and relationships
    const parcelKey = `property_${seed.parcel_id || seed.request_identifier || ""}`;
    const acctKey = `property_${seed.request_identifier}`;
    const ownersRoot =
        ownersData[parcelKey] ||
        ownersData[acctKey] ||
        ownersData[Object.keys(ownersData)[0]];
    const ownersByDate =
        ownersRoot && ownersRoot.owners_by_date ? ownersRoot.owners_by_date : {};

    const personMap = new Map();
    const persons = [];
    function personKey(p) {
        return [p.first_name || "", p.middle_name || "", p.last_name || ""]
            .join("|")
            .toLowerCase();
    }
    function addPerson(p) {
        const k = personKey(p);
        if (personMap.has(k)) return personMap.get(k);
        const idx = persons.length + 1;
        const first = titleCaseName(p.first_name);
        const last = titleCaseName(p.last_name);
        const middle = p.middle_name ? titleCaseName(p.middle_name) : null;
        const personObj = {
            birth_date: null,
            first_name: first,
            last_name: last,
            middle_name: middle,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
        };
        const file = `person_${idx}.json`;
        persons.push({ file, data: personObj, k });
        personMap.set(k, file);
        return file;
    }
    Object.keys(ownersByDate).forEach((dateKey) => {
        (ownersByDate[dateKey] || []).forEach((o) => {
            if (o.type === "person") addPerson(o);
        });
    });
    persons.forEach((p) => writeJson(path.join("data", p.file), p.data));

    const companies = [];
    const companyMap = new Map();
    const currentOwners = ownersByDate["current"] || [];
    currentOwners
        .filter((o) => o.type === "company" && o.name)
        .forEach((o) => {
            const name = o.name;
            if (companyMap.has(name)) return;
            const idx = companies.length + 1;
            const companyObj = { name };
            const file = `company_${idx}.json`;
            companies.push({ file, data: companyObj, name });
            companyMap.set(name, file);
        });
    companies.forEach((c) => writeJson(path.join("data", c.file), c.data));

    // Relationships between property and owner entities are not emitted here
    // because the downstream process populates them using validated CIDs.

    // Utilities
    const utilsRoot =
        utilitiesData[acctKey] ||
        utilitiesData[parcelKey] ||
        utilitiesData[Object.keys(utilitiesData)[0]] ||
        {};
    const utilityOut = {
        cooling_system_type: utilsRoot.cooling_system_type ?? null,
        heating_system_type: utilsRoot.heating_system_type ?? null,
        public_utility_type:
            utilsRoot.public_ility_type ?? utilsRoot.public_utility_type ?? null,
        sewer_type: utilsRoot.sewer_type ?? null,
        water_source_type: utilsRoot.water_source_type ?? null,
        plumbing_system_type: utilsRoot.plumbing_system_type ?? null,
        plumbing_system_type_other_description:
            utilsRoot.plumbing_system_type_other_description ?? null,
        electrical_panel_capacity: utilsRoot.electrical_panel_capacity ?? null,
        electrical_wiring_type: utilsRoot.electrical_wiring_type ?? null,
        hvac_condensing_unit_present:
            utilsRoot.hvac_condensing_unit_present ?? null,
        electrical_wiring_type_other_description:
            utilsRoot.electrical_wiring_type_other_description ?? null,
        solar_panel_present: utilsRoot.solar_panel_present ?? null,
        solar_panel_type: utilsRoot.solar_panel_type ?? null,
        solar_panel_type_other_description:
            utilsRoot.solar_panel_type_other_description ?? null,
        smart_home_features: utilsRoot.smart_home_features ?? null,
        smart_home_features_other_description:
            utilsRoot.smart_home_features_other_description ?? null,
        hvac_unit_condition: utilsRoot.hvac_unit_condition ?? null,
        solar_inverter_visible: utilsRoot.solar_inverter_visible ?? null,
        hvac_unit_issues: utilsRoot.hvac_unit_issues ?? null,
        electrical_panel_installation_date:
            utilsRoot.electrical_panel_installation_date ?? null,
        electrical_rewire_date: utilsRoot.electrical_rewire_date ?? null,
        hvac_capacity_kw: utilsRoot.hvac_capacity_kw ?? null,
        hvac_capacity_tons: utilsRoot.hvac_capacity_tons ?? null,
        hvac_equipment_component: utilsRoot.hvac_equipment_component ?? null,
        hvac_equipment_manufacturer: utilsRoot.hvac_equipment_manufacturer ?? null,
        hvac_equipment_model: utilsRoot.hvac_equipment_model ?? null,
        hvac_installation_date: utilsRoot.hvac_installation_date ?? null,
        hvac_seer_rating: utilsRoot.hvac_seer_rating ?? null,
        hvac_system_configuration: utilsRoot.hvac_system_configuration ?? null,
        plumbing_system_installation_date:
            utilsRoot.plumbing_system_installation_date ?? null,
        sewer_connection_date: utilsRoot.sewer_connection_date ?? null,
        solar_installation_date: utilsRoot.solar_installation_date ?? null,
        solar_inverter_installation_date:
            utilsRoot.solar_inverter_installation_date ?? null,
        solar_inverter_manufacturer: utilsRoot.solar_inverter_manufacturer ?? null,
        solar_inverter_model: utilsRoot.solar_inverter_model ?? null,
        water_connection_date: utilsRoot.water_connection_date ?? null,
        water_heater_installation_date:
            utilsRoot.water_heater_installation_date ?? null,
        water_heater_manufacturer: utilsRoot.water_heater_manufacturer ?? null,
        water_heater_model: utilsRoot.water_heater_model ?? null,
        well_installation_date: utilsRoot.well_installation_date ?? null,
    };
    writeJson(path.join("data", "utility.json"), utilityOut);

    // Layouts
    const layoutRoot =
        layoutData[acctKey] ||
        layoutData[parcelKey] ||
        layoutData[Object.keys(layoutData)[0]] ||
        {};
    const layouts = layoutRoot.layouts || [];
    layouts.forEach((l, i) => {
        const out = {
            space_type: l.space_type ?? null,
            space_index: l.space_index,
            flooring_material_type: l.flooring_material_type ?? null,
            size_square_feet: l.size_square_feet ?? null,
            floor_level: l.floor_level ?? null,
            has_windows: l.has_windows ?? null,
            window_design_type: l.window_design_type ?? null,
            window_material_type: l.window_material_type ?? null,
            window_treatment_type: l.window_treatment_type ?? null,
            is_finished: l.is_finished ?? null,
            furnished: l.furnished ?? null,
            paint_condition: l.paint_condition ?? null,
            flooring_wear: l.flooring_wear ?? null,
            clutter_level: l.clutter_level ?? null,
            visible_damage: l.visible_damage ?? null,
            countertop_material: l.countertop_material ?? null,
            cabinet_style: l.cabinet_style ?? null,
            fixture_finish_quality: l.fixture_finish_quality ?? null,
            design_style: l.design_style ?? null,
            natural_light_quality: l.natural_light_quality ?? null,
            decor_elements: l.decor_elements ?? null,
            pool_type: l.pool_type ?? null,
            pool_equipment: l.pool_equipment ?? null,
            spa_type: l.spa_type ?? null,
            safety_features: l.safety_features ?? null,
            view_type: l.view_type ?? null,
            lighting_features: l.lighting_features ?? null,
            condition_issues: l.condition_issues ?? null,
            is_exterior: l.is_exterior ?? false,
            pool_condition: l.pool_condition ?? null,
            pool_surface_type: l.pool_surface_type ?? null,
            pool_water_quality: l.pool_water_quality ?? null,
            bathroom_renovation_date: l.bathroom_renovation_date ?? null,
            kitchen_renovation_date: l.kitchen_renovation_date ?? null,
            flooring_installation_date: l.flooring_installation_date ?? null,
        };
        writeJson(path.join("data", `layout_${i + 1}.json`), out);
    });

    // Structure
    const wallText = getValueByStrong($, "Wall");
    const exteriorCover = getValueByStrong($, "Exterior Cover");
    const roofCover = getValueByStrong($, "Roof Cover");
    const maxStories = getValueByStrong($, "Max Stories");
    const finishedArea =
        getValueByStrong($, "Total Finished Area") ||
        getValueByStrong($, "Finished Area");

    const useCode = useCodeText || "";
    const structureOut = {
        architectural_style_type: null,
        attachment_type: useCode.toLowerCase().includes("attached")
            ? "Attached"
            : null,
        exterior_wall_material_primary:
            wallText && wallText.toLowerCase().includes("concrete block")
                ? "Concrete Block"
                : null,
        exterior_wall_material_secondary:
            exteriorCover && exteriorCover.toLowerCase().includes("stucco")
                ? "Stucco Accent"
                : null,
        exterior_wall_condition: null,
        exterior_wall_insulation_type: null,
        flooring_material_primary: null,
        flooring_material_secondary: null,
        subfloor_material: null,
        flooring_condition: null,
        interior_wall_structure_material: null,
        interior_wall_surface_material_primary: null,
        interior_wall_surface_material_secondary: null,
        interior_wall_finish_primary: null,
        interior_wall_finish_secondary: null,
        interior_wall_condition: null,
        roof_covering_material: mapRoofCovering(roofCover),
        roof_underlayment_type: null,
        roof_structure_material: null,
        roof_design_type: null,
        roof_condition: null,
        roof_age_years: null,
        gutters_material: null,
        gutters_condition: null,
        roof_material_type: mapRoofCovering(roofCover) ? "Shingle" : null,
        foundation_type: null,
        foundation_material: null,
        foundation_waterproofing: null,
        foundation_condition: null,
        ceiling_structure_material: null,
        ceiling_surface_material: null,
        ceiling_insulation_type: null,
        ceiling_height_average: null,
        ceiling_condition: null,
        exterior_door_material: null,
        interior_door_material: null,
        window_frame_material: null,
        window_glazing_type: null,
        window_operation_type: null,
        window_screen_material: null,
        primary_framing_material:
            wallText && wallText.toLowerCase().includes("concrete block")
                ? "Concrete Block"
                : null,
        secondary_framing_material: null,
        structural_damage_indicators: null,
        finished_base_area: finishedArea ? cleanNum(finishedArea) : null,
        finished_basement_area: null,
        finished_upper_story_area: 0,
        unfinished_base_area: null,
        unfinished_basement_area: null,
        unfinished_upper_story_area: null,
        number_of_stories: maxStories ? parseFloat(maxStories) : null,
        exterior_door_installation_date: null,
        siding_installation_date: null,
        roof_date: null,
        window_installation_date: null,
        foundation_repair_date: null,
    };
    writeJson(path.join("data", "structure.json"), structureOut);
}

try {
    main();
    console.log("Script executed successfully.");
} catch (e) {
    try {
        const obj = JSON.parse(e.message);
        console.error(JSON.stringify(obj));
    } catch (_) {
        console.error(e.stack || String(e));
    }
    process.exit(1);
}
