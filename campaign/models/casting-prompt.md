# Dream Studios — AI Model Casting Prompt

A prompt for Claude (or any image agent) to build the recurring Dream Studios model roster: six AI models we reuse in every campaign, so each one needs a locked, repeatable look.

---

## The prompt

> You are casting director and photographer for **Dream Studios**, a young streetwear label (graphic tees, logo tees, "Created By God" denim). The brand voice is ironic, warm, a little chaotic, and comes from a group of friends. Think Gen-Z Mediterranean streetwear: Ibiza summers, New York rooftops, overthinking things at 2am.
>
> Create **6 recurring AI models**. Each one should feel like a real person you'd follow on Instagram, not like a stock "AI model". Rules:
>
> 1. **Make them attractive, warm and real.** These are good-looking models with glowing natural skin, real texture and pores, and fresh minimal makeup. They should look approachable, with soft smiles or a relaxed confident look. Avoid harsh or severe styling, heavy piercings, and anything that reads as edgy for its own sake.
> 2. **Mix them.** Use different ethnicities, face shapes, hair textures and energies. Required: one girl with lots of natural freckles and one model with deep dark skin.
> 3. **Make them young and cool.** Ages 19–25. The cool comes from the clothes and the attitude, not from shock styling. Jewellery is minimal: small hoops, studs and thin chains. No cross earrings or religious jewellery.
> 4. **Don't copy the references.** The Nude Project references set the *mood*: oversized washed layers, ironic captions and film-photo grain. Do not reproduce their faces, poses or garments.
> 5. **Shoot them in a studio.** Use a seamless warm off-white paper backdrop, a soft diffused key light with a subtle flash and gentle shadows. Shoot on 35mm-film colour (Portra 400 feel) with fine grain. The result should look like a clean, modern streetwear campaign.
> 6. **Dress them in a Dream Studios wardrobe.** Use faded navy, washed black, bone white, tobacco brown and one accent colour (cherry red). Clothes should look boxy and oversized, washed, and lived-in. A small embroidered lowercase "ds" monogram may appear on the chest, but don't print other brand names or random lettering.
> 7. **Give each model a character bible**: name, age, background, personality, signature look, wardrobe and a sample caption in the brand voice. Then generate a **3:4 studio hero portrait** for each model. Later, use that portrait as the identity reference for full-body shots, group shots and campaigns.

---

## The roster

### 01 — MAYA (the freckled one)
- **Age / background:** 20, Irish-Spanish, grew up in Valencia
- **Personality:** the warm older-sister type who has burned every lighter she's ever owned
- **Face:** fair glowing skin covered in natural cinnamon freckles across her nose, cheeks and forehead. Soft grey-green eyes, full natural lips, gentle smile.
- **Hair:** long soft copper-auburn waves with light curtain bangs
- **Signature:** small gold hoops, thin gold necklace
- **Wardrobe:** oversized washed-navy zip hoodie over a white ribbed tank
- **Caption:** *"she said namasté and then left without paying"*

### 02 — KOFI (the dark-skinned one)
- **Age / background:** 22, Ghanaian-British, from South London, lives in Madrid
- **Personality:** calm, stylish and secretly the funniest in the group
- **Face:** deep dark brown glowing skin, high cheekbones, defined jaw, warm brown eyes and a big easy smile
- **Hair:** short neat black hair with a clean fade
- **Signature:** small silver stud earring, thin chain
- **Wardrobe:** boxy tobacco-brown suede overshirt, white tee, relaxed black trousers
- **Caption:** *"he doesn't post. he gets posted."*

### 03 — RIN
- **Age / background:** 21, Japanese-Korean, art student in Barcelona
- **Personality:** calm and minimal, and has already judged your playlist
- **Face:** luminous porcelain skin, soft dark eyes, a small beauty mark under her right eye, rosy lips
- **Hair:** glossy black chin-length bob with soft wispy bangs
- **Signature:** small silver hoops
- **Wardrobe:** oversized grey blazer over a white tank, relaxed blue jeans
- **Caption:** *"not interested. but tell me more."*

### 04 — LUCA (the curly one)
- **Age / background:** 23, Italian-Argentinian, skates and DJs badly
- **Personality:** the charming friend who says "trust me" right before the best night of your summer
- **Face:** olive sun-kissed skin, light stubble, warm hazel eyes and a charming smile
- **Hair:** soft tousled chestnut curls, medium length
- **Signature:** one thin silver ring
- **Wardrobe:** washed dark work jacket, white tee, loose light-wash denim
- **Caption:** *"warriors with a dream (and no plan)"*

### 05 — ZARA
- **Age / background:** 20, Moroccan-French, from Marseille
- **Personality:** the main character who pretends she isn't
- **Face:** warm golden-olive glowing skin, big dark almond eyes, soft brown lip, a small beauty mark above her lip
- **Hair:** long glossy dark-brown voluminous waves
- **Signature:** small gold hoops, delicate layered gold necklaces
- **Wardrobe:** cherry-red fitted knit top, relaxed washed-black trousers
- **Caption:** *"it's giving 'i'm not like other girls' (she is exactly like other girls)"*

### 06 — NICO (the special one)
- **Age / background:** 19, Brazilian, the youngest. He just got scouted outside a bakery.
- **Personality:** golden-retriever energy and the biggest laugh in the room
- **Face:** warm brown skin with subtle, natural vitiligo, one soft patch at the outer corner of his left eye and a small one on his chin. Bright eyes and a huge smile.
- **Hair:** short natural curls
- **Signature:** thin beaded necklace, no earrings
- **Wardrobe:** oversized navy-and-cream varsity jacket with a "ds" monogram, white tee, light vintage denim
- **Caption:** *"created by god. styled by himself."*

---

## Generated assets (Higgsfield, Oct 2026, v2: softer look)

Pass these job IDs as reference images (`medias`) in new generations to keep the same faces.

| Model | Hero portrait | Higgsfield job ID |
|---|---|---|
| Maya | `hero/01-maya.png` | `32cdebfc-d84b-4341-9d2e-2392e838adcf` |
| Kofi | `hero/02-kofi.png` | `5334d580-2c50-46db-919b-4ddead519e55` |
| Rin | `hero/03-rin.png` | `c9a433b5-45e6-4996-8f13-ff41deb5535e` |
| Luca | `hero/04-luca.png` | `b78f33c3-7e13-4399-a2a7-84583b71cad0` |
| Zara | `hero/05-zara.png` | `c9dec40e-40d0-4158-a5f0-48dd4dc8ed6f` |
| Nico | `hero/06-nico.png` | `478ab8cc-d7ce-4d58-aa95-06838529eb50` |
| Group | `group/01-the-crew.png` | `926df7ad-d890-496b-beba-9bb4aba193ec` |

### Full-body shots (tough attitude)

These are the campaign attitude: good-looking faces with a hard attitude. Expect fierce stares, power poses (hand on hip, arms crossed, low squat), sunglasses, leather and boots, a slightly low camera angle, and a hard on-camera flash with crisp shadows. A contact sheet of all six is in `fullbody/lineup-preview.jpg`.

| Model | Full-body | Higgsfield job ID |
|---|---|---|
| Maya | `fullbody/01-maya.png` | `2bb91c01-8a29-4f3b-941f-68f3aef4d110` |
| Kofi | `fullbody/02-kofi.png` | `18089299-6113-4e5d-b841-3db0ae92d32b` |
| Rin | `fullbody/03-rin.png` | `e1a8c883-fbdc-4c4c-b8f5-6370e292dfb1` |
| Luca | `fullbody/04-luca.png` | `7283c97c-3099-42d9-ac57-385dd308870b` |
| Zara | `fullbody/05-zara.png` | `b3155928-20a3-4257-a349-05e3b936c95a` |
| Nico | `fullbody/06-nico.png` | `905d7b69-07dd-4e1e-aefb-7826cb8fdc8c` |

**What worked:**
- **Single portraits:** Soul 2.0 (`soul_2`) at 3:4. Words like "beautiful/handsome model, glowing skin, soft diffused light, warm smile" keep the look attractive instead of harsh.
- **Edits and multi-person shots:** GPT Image 2.5 (`gpt_image_2_5`, quality high, 2k) with the hero portraits as `image_references`. I used it for Maya's stronger freckles, Nico's vitiligo and "ds" monogram, and the group shot.
- **Watch out for:** Soul 2.0 tends to add random lettering on varsity jackets, and it drew vitiligo as paint. Fix both with a GPT Image 2.5 edit.
- **Rate limit:** the Pro plan runs 4 jobs at a time, so submit 4 or fewer per batch.

## Next steps for campaigns

1. **Lock identities:** use each hero portrait (`hero/`) as the reference image for every new shot of that model. For perfect consistency, train a Higgsfield Soul ID per model.
2. **Shoot full-body and group shots** in the same studio setup (`fullbody/`, `group/`).
3. **Move to campaign locations:** a rooftop in NY, an Ibiza dinner table, a Tel Aviv balcony. Keep the 35mm film look and the ironic captions.
