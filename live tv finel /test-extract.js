const str = "https://dash.vodep39240327.workers.dev/?url=https://jiotvpllive.cdn.jio.com/bpk-tv/CNBC_Tv18_Prime_HD_BTS/output/index.mpd?name=CNBC_Tv18_Prime_HD&keyId=810f0869e10c537891203cc70315dd6d&key=b8f7d22abf86cf12444a848ed5dbec13&cookie=__hdnea__=st=1775196803~exp=1775218403~acl=/*~hmac=0f83e72d31f67fe396584c901763e8d2f5bcd4bb74d480edd67f4aeb8c6da14a";
// To extract raw mpd URL, we can match "url=https://..." up to the next "&" except there's "&cookie=" and stuff.
// Actually, `dash.workers...dev/?url=` doesn't URL-encode the rest. So we can just split by '?url=' and take the rest.
let extracted = str.split('?url=')[1];
// BUT wait, it might pass &keyId and &key and &cookie to the worker, NOT to the MPD.
// BUT for Jiotv we need the cookie on the MPD request.
// Wait, the MPD request fails if the cookie is wrong or missing. Or we can just fetch the base MPD.
const baseMpd = extracted.split('?')[0];

console.log("Base MPD:", baseMpd);
