# Max 2: "This is Max." Higgsfield prompts (Seedance 2.5)

Shared settings for G1–G5: `model: seedance_2_5`, `mode: omni_reference`, `aspect_ratio: 16:9`, `generate_audio: true`,
`draft: true` (480p; finalized later at 1080p with `draft_job_id`).
`image_references` = R1 (Max, clean portrait) + R2 (the office).

- **R1:** `refs/max-ref.png`, a Nano Banana Pro re-render of a frame from the previous Max draft.
- **R2:** `refs/office-480.png`, a frame from the previous draft.
- **R3:** `refs/poster-start.png`, the opening frame for G5 (prompt below).

## Shared style block (opens every prompt)
```
Shot on a 14mm rectilinear ultra-wide prime, camera always close to the subject, deep focus, exaggerated perspective, soft natural window daylight, warm muted film color, gentle 35mm grain, 24fps, 180-degree shutter. A deadpan comedy played completely straight: nobody reacts to a dog working in an office. Character: Max, the exact golden retriever from the reference image, photoreal natural fur, light blue office shirt and loose navy tie, sits upright in an office chair like a person and uses his front paws like hands. Setting: the same bright open-plan startup office as the reference: white desks, plants, concrete ceiling with cable trays and linear lights, coworkers in the background. The coworker, when she appears: a woman in her 30s, dark curly hair in a bun, mustard-yellow knit sweater, silver watch. Rules: consistent dog, shirt and tie in every shot; real dog anatomy; no on-screen text, no captions, no logos, no Apple logo, no readable UI, no morphing, no extra limbs, no warped faces from the wide lens, no cartoon or CGI look.
```

## G1: morning, the problem (15s)
```
[0-4s] 14mm at Max's eye level, the lens about 40 cm from his face, one slow steady push-in. Max sits behind an open laptop and looks straight into the lens with a calm, serious, slightly tired expression, blinks once. The office stretches behind him in deep focus: coworkers walking with coffee, someone at a whiteboard. Sound: soft office room tone, distant keyboards.
[4-8s] 14mm over Max's right shoulder, the lens beside his ear, looking at the laptop: a spreadsheet full of numbers, soft and unreadable. His paw hovers over the trackpad; he tilts his head left, then right, completely lost; then he turns his face to the lens and lets out a long heavy sigh through his nose, cheeks puffing, ears drooping. Sound: trackpad taps, a long dog sigh.
[8-11s] Extreme low angle, the lens almost touching the desk surface: the coworker's hands slam a huge tower of paper documents and folders, about 60 cm tall, down onto the desk right in front of the lens. On impact loose sheets lift and flutter, a pen bounces, the coffee in the mug ripples. Sound: a heavy paper thud.
[11-15s] 14mm low wide angle from beside the paper tower: the tower dominates the foreground and Max sits behind it looking tiny. He slowly leans sideways to peek around it, eyes wide, ears flattening; looks at the tower, at his laptop, back at the tower, helpless. The coworker walks away in the background. Sound: room tone, a small whine.
```

## G2: the trigger (7s)
```
[0-3s] Macro on the laptop keyboard, the 14mm lens almost touching the keys: Max's furry golden paw comes in from above and deliberately presses the option key, then his other paw presses the space bar; the keys visibly travel down. As they go down a warm orange light from the screen washes over the keys and his fur. Sound: two crisp mechanical key clicks.
[3-7s] Extreme macro of Max's right eye, one very slow steady push-in for the whole shot so the eye fills more and more of the frame. Glossy dark-brown iris, fine fur and eyelashes, a moist cornea holding a crisp reflection of the bright laptop screen in front of him; inside the reflection a small bright orange point glides and stops. The pupil slightly dilates. Warm orange screen light on his fur. Sound: a soft rising hum.
```

## G3: hyperlapse (10s)
```
One continuous shot, a hyperlapse: time passes extremely fast while the camera makes one smooth 360-degree orbit around Max at his desk, 14mm lens about 1.2 m from him at desk height, constant orbit speed. Max stays sharp and works in a frantic sped-up blur of productivity: paws flying over the keyboard, grabbing documents from the tall tower on his left, scanning them, stamping them and tossing them onto a neat finished pile on his right. The tower on his left shrinks steadily to nothing by the end; the finished pile grows. Around him time races: coworkers become motion-blurred streaks walking past, then fewer, putting on jackets and leaving; daylight in the windows goes from bright midday to golden sunset to deep blue night, clouds racing; the ceiling lights switch off row by row until the office is dark and empty, lit only by Max's desk lamp and the warm glow of his laptop. Sound: fast clock ticking, rapid typing, paper rustle.
```

## G4: the payoff (12s)
```
[0-4s] Night, the dark empty office, 14mm low wide angle at desk height: Max leans far back in his chair with both hind paws up on the desk, completely relaxed, the laptop glowing beside one neat finished stack of documents. He holds a cold glass bottle of beer in his front paw, takes a slow sip, then breathes out content with half-closed eyes. City lights through the windows behind him. Sound: quiet night hum, a bottle clink, a satisfied exhale.
[4-9s] Next morning, bright daylight. 14mm close on the coworker's face at eye level as she stops beside Max's desk holding a coffee cup and glances down. The camera whip-pans fast to the right like a quick double-take, landing on Max's desk: the tower of documents is gone, everything is done, sorted into neat folders and one tidy finished stack, the laptop showing a clean colorful chart. Then the camera whip-pans straight back to her face: jaw dropped, eyes wide, eyebrows up, completely stunned. Strong motion blur on both whip pans. Sound: two quick whooshes.
[9-12s] Medium shot, 14mm at eye level about 1 m away: Max sits in his chair in the morning sun, looking at the camera with a happy open-mouthed dog smile, tongue just visible, ears relaxed, chest up, proud and content. Sound: room tone, a soft happy huff.
```

## R3: Nano Banana Pro, opening frame for G5 (image_references = R1, R2)
```
A photoreal still from the same film as the reference images, shot on a 14mm ultra-wide lens at about chest height, bright open-plan startup office in soft natural daylight, warm muted film color, gentle grain. On a clean white wall on the left half of the frame hangs a black-framed poster: a bold elegant serif title that reads exactly "EMPLOYEE OF THE MONTH", a small gold seal, and below the title a framed portrait photo of the golden retriever from the reference in his light blue shirt and navy tie. On the right side of the frame, Max's white desk with his open silver laptop, a white coffee mug and a black office chair. Plants and the open office in soft focus in the background. Nobody in frame. The only text anywhere in the image is EMPLOYEE OF THE MONTH, spelled correctly. No logos.
```

## G5: two weeks later (8s), `start_image` = R3
```
[0-5s] Continue exactly from the start image. Max walks into frame from the left on all fours, carrying his white coffee mug in his mouth, passes in front of the wall and stops beside the poster; he looks up at the poster of himself for a beat, then turns his head toward his laptop on the desk. The poster stays perfectly still and unchanged, the printed title sharp and readable whenever it is not covered. Sound: soft paw steps, office ambience.
[5-8s] Close-up, 14mm about 30 cm from Max's face at his desk, warm screen light on his fur: he looks at the laptop screen and slowly, deliberately winks one eye at it with a small proud smile, then opens it. Sound: room tone.
```

## Music: `elevenlabs_music_v2_5`, 36s, `force_instrumental: true`
```
Energetic, driving, rhythmic instrumental for a comedy ad montage: tight funk-electronic groove around 124 BPM, punchy live-sounding drums, slap bass, bright brass and synth stabs, hand claps, building momentum, a clean button ending. No vocals.
```

## Narrator (ElevenLabs)
- "This… is Max."
- "Max doesn't know how to make an Excel chart."
- "Luckily, Max has Pointy. The AI that shows you where to click."
- "Pointy. Easy to click."
