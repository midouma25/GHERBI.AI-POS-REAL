/**
 * assets/js/numberToWords.js
 * محرك التفقيط المالي (Financial Number to Words Engine) لـ Gherbi.Ai POS
 * يدعم: العربية (بقواعد النحو للإفراد والتثنية والجمع)، الفرنسية، والإنجليزية.
 * مخصص خصيصاً للعملة الجزائرية (الدينار والسنتيم).
 */

'use strict';

const NumberToWords = (function () {
    // ============================================================================
    // 1. القاموس العربي (Arabic Dictionary - DZD)
    // ============================================================================
    const arUnits = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
    const arTeens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const arTens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const arHundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

    function convertArabicGroup(num) {
        let str = "";
        let h = Math.floor(num / 100);
        let t = Math.floor((num % 100) / 10);
        let u = num % 10;

        if (h > 0) {
            str += arHundreds[h];
        }

        let tensUnits = "";
        if (t === 0) {
            if (u > 0) tensUnits = arUnits[u];
        } else if (t === 1) {
            tensUnits = arTeens[u];
        } else {
            if (u > 0) {
                tensUnits = arUnits[u] + " و" + arTens[t];
            } else {
                tensUnits = arTens[t];
            }
        }

        if (tensUnits !== "") {
            if (str !== "") str += " و";
            str += tensUnits;
        }
        return str;
    }

    function tafqeetArabic(number) {
        if (number === 0) return "صفر دينار جزائري";

        const dinars = Math.floor(number);
        const centimes = Math.round((number - dinars) * 100);

        let dinarStr = "";
        if (dinars === 1) dinarStr = "دينار جزائري واحد";
        else if (dinars === 2) dinarStr = "ديناران جزائريان";
        else if (dinars > 0) {
            let parts = [];
            let billions = Math.floor(dinars / 1000000000);
            let millions = Math.floor((dinars % 1000000000) / 1000000);
            let thousands = Math.floor((dinars % 1000000) / 1000);
            let remainder = dinars % 1000;

            if (billions > 0) {
                if (billions === 1) parts.push("مليار");
                else if (billions === 2) parts.push("ملياران");
                else if (billions >= 3 && billions <= 10) parts.push(convertArabicGroup(billions) + " مليارات");
                else parts.push(convertArabicGroup(billions) + " مليار");
            }

            if (millions > 0) {
                if (millions === 1) parts.push("مليون");
                else if (millions === 2) parts.push("مليونان");
                else if (millions >= 3 && millions <= 10) parts.push(convertArabicGroup(millions) + " ملايين");
                else parts.push(convertArabicGroup(millions) + " مليون");
            }

            if (thousands > 0) {
                if (thousands === 1) parts.push("ألف");
                else if (thousands === 2) parts.push("ألفان");
                else if (thousands >= 3 && thousands <= 10) parts.push(convertArabicGroup(thousands) + " آلاف");
                else parts.push(convertArabicGroup(thousands) + " ألف");
            }

            if (remainder > 0) {
                parts.push(convertArabicGroup(remainder));
            }

            dinarStr = parts.join(" و") + " دينار جزائري";
        }

        let centimeStr = "";
        if (centimes > 0) {
            if (centimes === 1) centimeStr = "سنتيم واحد";
            else if (centimes === 2) centimeStr = "سنتيمان";
            else if (centimes >= 3 && centimes <= 10) centimeStr = convertArabicGroup(centimes) + " سنتميات";
            else centimeStr = convertArabicGroup(centimes) + " سنتيماً";
        }

        if (dinarStr && centimeStr) return dinarStr + " و " + centimeStr;
        if (centimeStr) return centimeStr;
        return dinarStr;
    }

    // ============================================================================
    // 2. القاموس الفرنسي (French Dictionary - DZD)
    // ============================================================================
    const frUnits = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
    const frTeens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
    const frTens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"];

    function convertFrenchGroup(num) {
        if (num === 0) return "";
        let str = "";
        let h = Math.floor(num / 100);
        let rem = num % 100;

        if (h > 0) {
            if (h === 1) str += "cent ";
            else str += frUnits[h] + " cent " + (rem === 0 ? "s " : "");
        }

        if (rem > 0) {
            if (rem < 10) str += frUnits[rem];
            else if (rem < 20) str += frTeens[rem - 10];
            else {
                let t = Math.floor(rem / 10);
                let u = rem % 10;
                if (t === 7) {
                    str += (u === 1 ? "soixante et onze" : "soixante-dix" + (u > 0 ? "-" + frUnits[u] : ""));
                } else if (t === 9) {
                    str += "quatre-vingt-dix" + (u > 0 ? "-" + frUnits[u] : "");
                } else if (t === 8) {
                    str += "quatre-vingt" + (u === 0 ? "s" : "-" + frUnits[u]);
                } else {
                    str += frTens[t];
                    if (u === 1) str += " et un";
                    else if (u > 1) str += "-" + frUnits[u];
                }
            }
        }
        return str.trim();
    }

    function tafqeetFrench(number) {
        if (number === 0) return "Zéro Dinar Algérien";

        const dinars = Math.floor(number);
        const centimes = Math.round((number - dinars) * 100);
        let dinarStr = "";

        if (dinars > 0) {
            let parts = [];
            let billions = Math.floor(dinars / 1000000000);
            let millions = Math.floor((dinars % 1000000000) / 1000000);
            let thousands = Math.floor((dinars % 1000000) / 1000);
            let remainder = dinars % 1000;

            if (billions > 0) parts.push(convertFrenchGroup(billions) + (billions > 1 ? " milliards" : " milliard"));
            if (millions > 0) parts.push(convertFrenchGroup(millions) + (millions > 1 ? " millions" : " million"));
            if (thousands > 0) parts.push((thousands === 1 ? "mille" : convertFrenchGroup(thousands) + " mille"));
            if (remainder > 0) parts.push(convertFrenchGroup(remainder));

            dinarStr = parts.join(" ") + " Dinars Algériens";
        }

        let centimeStr = "";
        if (centimes > 0) {
            centimeStr = convertFrenchGroup(centimes) + " Centimes";
        }

        let result = "";
        if (dinarStr && centimeStr) result = dinarStr + " et " + centimeStr;
        else if (centimeStr) result = centimeStr;
        else result = dinarStr;

        // رسملة الحرف الأول
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    // ============================================================================
    // 3. القاموس الإنجليزي (English Dictionary - DZD)
    // ============================================================================
    const enUnits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const enTeens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const enTens = ["", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function convertEnglishGroup(num) {
        if (num === 0) return "";
        let str = "";
        let h = Math.floor(num / 100);
        let rem = num % 100;

        if (h > 0) {
            str += enUnits[h] + " Hundred ";
        }

        if (rem > 0) {
            if (h > 0) str += "and ";
            if (rem < 10) str += enUnits[rem];
            else if (rem < 20) str += enTeens[rem - 10];
            else {
                let t = Math.floor(rem / 10);
                let u = rem % 10;
                str += enTens[t];
                if (u > 0) str += "-" + enUnits[u];
            }
        }
        return str.trim();
    }

    function tafqeetEnglish(number) {
        if (number === 0) return "Zero Algerian Dinars";

        const dinars = Math.floor(number);
        const centimes = Math.round((number - dinars) * 100);
        let dinarStr = "";

        if (dinars > 0) {
            let parts = [];
            let billions = Math.floor(dinars / 1000000000);
            let millions = Math.floor((dinars % 1000000000) / 1000000);
            let thousands = Math.floor((dinars % 1000000) / 1000);
            let remainder = dinars % 1000;

            if (billions > 0) parts.push(convertEnglishGroup(billions) + " Billion");
            if (millions > 0) parts.push(convertEnglishGroup(millions) + " Million");
            if (thousands > 0) parts.push(convertEnglishGroup(thousands) + " Thousand");
            if (remainder > 0) parts.push(convertEnglishGroup(remainder));

            dinarStr = parts.join(" ") + " Algerian Dinars";
        }

        let centimeStr = "";
        if (centimes > 0) {
            centimeStr = convertEnglishGroup(centimes) + " Centimes";
        }

        if (dinarStr && centimeStr) return dinarStr + " and " + centimeStr;
        if (centimeStr) return centimeStr;
        return dinarStr;
    }

    // ============================================================================
    // التصدير للاستخدام العام (Public API)
    // ============================================================================
    return {
        /**
         * تحويل رقم مالي إلى حروف حسب اللغة المطلوبة
         * @param {number} num - المبلغ المالي
         * @param {string} lang - رمز اللغة ('ar', 'fr', 'en')
         * @returns {string} المبلغ مفقطاً بالحروف
         */
        toWords: function (num, lang = 'ar') {
            const cleanNum = Number(num);
            if (isNaN(cleanNum)) return "";

            const l = String(lang).toLowerCase().trim();
            if (l === 'fr') return tafqeetFrench(cleanNum);
            if (l === 'en') return tafqeetEnglish(cleanNum);
            
            // الافتراضي هو العربية
            return "فقط " + tafqeetArabic(cleanNum) + " لا غير.";
        }
    };
})();

// توافقية التصدير ليعمل في Node.js (للخلفية) والمتصفح (للواجهة الأمامية)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NumberToWords;
} else if (typeof window !== 'undefined') {
    window.NumberToWords = NumberToWords;
}