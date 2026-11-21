// My Strength AI recognition relay (Cloudflare Worker).
// Receives a photo from the app, asks Claude which machine it shows, and returns only a machine id.
// Your Anthropic API key stays here as a secret and is never sent to phones.
// Generated from the app's machine list; regenerate it when the list changes.

const PROMPT = "You identify gym equipment from a photo for a workout app.\n\nPick the machine from this list that best matches the photo. Use only these ids:\nlat_pulldown: Lat pulldown (Pulldown machine, Lat pull-down). Looks like: Seated machine with a thigh pad, a long bar hanging from a high cable above the seat, weight stack behind or beside it.\nseated_row: Seated cable row (Low row, Cable row station). Looks like: Long low bench or seat with foot plates, a cable coming out at about knee or chest height in front, usually a V-shaped or straight handle.\nleg_press: Leg press (45° leg press, Sled leg press, Seated leg press). Looks like: Reclined seat with a large foot platform on an angled sled or rails, often with weight plates loaded on horns beside the platform.\nleg_curl: Leg curl machine (Seated leg curl, Lying leg curl, Hamstring curl). Looks like: Machine with a padded roller behind the lower legs; either you sit with a pad on top of your thighs, or you lie face down on a bench with the roller above your heels.\nleg_extension: Leg extension machine (Quad extension). Looks like: Upright seat with a padded roller in front of the shins, near the ankles, and a pivot arm beside the knees.\nseated_calf: Seated calf raise machine (Seated calf machine). Looks like: Low seat with a padded lever that rests on top of the thighs just above the knees, and a small foot plate or step for the balls of the feet.\nstanding_calf: Standing calf raise (Standing calf machine, Calf raise step). Looks like: Either a machine with shoulder pads above a raised foot block, or a simple step or block with a rail to hold.\ncable_station: Cable machine (Cable station, Cable crossover, Functional trainer, Adjustable pulley). Looks like: Tall frame with one or two weight stacks and an adjustable pulley that slides up and down a column; attachments such as a rope or single handle clip onto the cable.\nbench_press: Flat bench press station (Bench press rack, Olympic bench). Looks like: Flat padded bench with two upright posts and bar hooks at the head end holding a long barbell, sometimes with safety arms.\nsquat_rack: Squat rack (Power rack, Squat cage, Squat stand). Looks like: Steel frame with four or two upright posts, adjustable J-hooks holding a barbell around chest height, and horizontal safety bars or pins.\nadjustable_bench: Adjustable bench (Incline bench, Utility bench, FID bench). Looks like: Padded bench with a backrest that tilts on a ladder or pin, often with a small adjustable seat pad; usually used with dumbbells.\ndumbbell_rack: Dumbbell rack (Dumbbells). Looks like: Rack holding pairs of dumbbells in rows, usually labelled with their weight.\npullup_station: Pull-up and dip station (Pull-up bar, Dip station, Assisted pull-up machine, Captain's chair). Looks like: Tall frame with a high bar for pull-ups and two parallel handles for dips; an assisted version has a knee platform and a weight stack.\nhip_thrust: Hip thrust machine (Glute bridge machine, Hip thrust bench). Looks like: Low bench or back pad with a padded belt or lever across the hips, for driving the hips upward.\nab_roller: Ab roller (Ab wheel). Looks like: Small wheel with a handle on each side.\ntreadmill: Treadmill (Running machine). Looks like: Running belt with side rails and a console with speed and incline controls.\nexercise_bike: Exercise bike (Spin bike, Upright bike, Stationary bike). Looks like: Stationary bicycle with a saddle, handlebars and a flywheel or resistance dial.\nchest_press: Chest press machine (Seated chest press). Looks like: Upright seat with two handles at chest height that you push forward.\npec_deck: Pec deck (Chest fly machine, Rear delt fly machine). Looks like: Seat with two padded arms or handles that swing together in an arc in front of the chest.\nshoulder_press_machine: Shoulder press machine (Seated shoulder press). Looks like: Upright seat with two handles at shoulder height that you push overhead.\nhip_abduction: Hip abduction / adduction machine (Outer thigh machine, Inner thigh machine). Looks like: Seat with two padded arms against the outside (abduction) or inside (adduction) of the knees.\nsmith_machine: Smith machine (Smith rack). Looks like: Barbell fixed inside vertical rails so it only moves straight up and down, with hooks to rack it by twisting the bar.\nhack_squat: Hack squat machine (Hack squat sled). Looks like: Angled sled with shoulder pads and a back pad that slides down rails over a foot platform.\nback_extension: Back extension bench (Hyperextension bench, Roman chair (45°)). Looks like: Angled frame with a hip pad and ankle rollers; you lean forward over the pad.\nrowing_machine: Rowing machine (Rower, Ergometer). Looks like: Long rail with a sliding seat, foot stretchers with straps and a handle on a chain or strap connected to a fan or flywheel.\nelliptical: Cross-trainer (Elliptical). Looks like: Standing machine with two foot pedals that move in an oval path and two moving handles.\n\nReply with JSON only, no other text:\n{\"id\": \"<best id, or null if nothing in the list matches or the photo isn't gym equipment>\",\n \"confidence\": \"high\" | \"medium\" | \"low\",\n \"alternatives\": [\"<up to 2 other plausible ids>\"],\n \"seen\": \"<one short sentence describing what is in the photo>\"}\n\nRules: never invent an id that is not in the list. If the photo is unclear, too dark, or shows a person rather than equipment, set id to null and say why in \"seen\". Do not give exercise advice.";
const IDS = ["lat_pulldown","seated_row","leg_press","leg_curl","leg_extension","seated_calf","standing_calf","cable_station","bench_press","squat_rack","adjustable_bench","dumbbell_rack","pullup_station","hip_thrust","ab_roller","treadmill","exercise_bike","chest_press","pec_deck","shoulder_press_machine","hip_abduction","smith_machine","hack_squat","back_extension","rowing_machine","elliptical"];
const DEFAULT_MODEL = "claude-haiku-5-5";
const DEFAULT_DAILY_LIMIT = 40;          // scans per network address per day (needs the LIMITS KV binding)
const MAX_IMAGE_CHARS = 2_000_000;       // about 1.5 MB of photo; the app sends ~150 KB

export default {
  async fetch(req, env, ctx) {
    const allowed = (env.ALLOWED_ORIGINS || "https://umabubs.github.io").split(",").map(s => s.trim());
    const origin = req.headers.get("origin") || "";
    const cors = {
      "access-control-allow-origin": allowed.includes(origin) ? origin : allowed[0],
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "vary": "origin"
    };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ error: "Use POST" }, 405);
    if (!allowed.includes(origin)) return reply({ error: "This site isn't allowed to use the relay" }, 403);
    if (!env.ANTHROPIC_API_KEY) return reply({ error: "The relay has no API key yet" }, 500);

    let body;
    try { body = await req.json(); } catch { return reply({ error: "Bad request" }, 400); }
    const image = body && body.image;
    const mediaType = (body && body.media_type) || "image/jpeg";
    if (typeof image !== "string" || !image.length) return reply({ error: "No photo" }, 400);
    if (image.length > MAX_IMAGE_CHARS) return reply({ error: "Photo too large" }, 413);
    if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return reply({ error: "Unsupported photo type" }, 415);

    // Daily limit per network address, so a leaked link can't run up your bill.
    if (env.LIMITS) {
      const who = req.headers.get("cf-connecting-ip") || "unknown";
      const key = new Date().toISOString().slice(0, 10) + ":" + who;
      const used = Number(await env.LIMITS.get(key)) || 0;
      if (used >= (Number(env.DAILY_LIMIT) || DEFAULT_DAILY_LIMIT)) return reply({ error: "limit" }, 429);
      ctx.waitUntil(env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 }));
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || DEFAULT_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: PROMPT }
        ] }]
      })
    });
    if (!upstream.ok) return reply({ error: "Recognition service error", status: upstream.status }, 502);

    const data = await upstream.json();
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    let out = {};
    try { out = JSON.parse(text.match(/\{[\s\S]*\}/)[0]); } catch { out = {}; }
    // Only ever return ids from the reviewed list; the photo is not stored anywhere.
    const id = IDS.includes(out.id) ? out.id : null;
    const alternatives = (Array.isArray(out.alternatives) ? out.alternatives : []).filter(x => IDS.includes(x) && x !== id).slice(0, 2);
    const confidence = ["high", "medium", "low"].includes(out.confidence) ? out.confidence : "low";
    return reply({ id, confidence: id ? confidence : "low", alternatives, seen: String(out.seen || "").slice(0, 220) });
  }
};
