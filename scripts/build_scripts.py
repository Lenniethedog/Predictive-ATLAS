#!/usr/bin/env python3
"""Interleave locked narration with unspoken animation cues."""

from pathlib import Path

ROOT = Path("/Users/sam/Predictive ATLAS/scripts")

HEADERS = {
    1: (
        "EPISODE 1 OF 5",
        "THE HEGEMON'S MIRROR: HOW THE PETRODOLLAR TRAPPED CHINA—AND HOW IT BREAKS",
    ),
    2: (
        "EPISODE 2 OF 5",
        "THE TRAGEDY OF BUFFER STATES: THE FINAL PARTITION OF UKRAINE",
    ),
    3: (
        "EPISODE 3 OF 5",
        "THE MALACCA SIEGE: THE MATH BEHIND CHINA'S CHOKEPOINT GAMBIT",
    ),
    4: (
        "EPISODE 4 OF 5",
        "THE GERMAN PIVOT: THE DAY THE EUROZONE CHOSE INDUSTRIAL SURVIVAL",
    ),
    5: (
        "EPISODE 5 OF 5",
        "THE SEMICONDUCTOR FORTRESS: THE REALIST CALCULUS OF A DESTROYED TSMC",
    ),
}

CUES = {
    1: [
        "[TITLE CARD, silent, three seconds: PREDICTIVE ATLAS. Then the episode title in small caps. Cut on the first spoken word. VISUAL: MACRO on a single crude barrel. PULL BACK to a black globe. Ice-white invoice threads run from Gulf loading buoys to crimson Chinese ports, then rebound as a thicker thread into a blue vault stenciled U.S. TREASURIES. A mirror wipe shows the same flow as a rising American fiscal-capacity bar. Hold on the mirror.]",
        "[VISUAL: TIMELINE, 1971 to 1975, left to right. The gold peg snaps and falls off the bottom of frame. Saudi loading terminals lock to a blue dollar glyph. Importer capitals across Europe and Asia recolor as their oil contracts flip to dollar settlement. Lower-third caption, no music sting: RELATIVE POWER COMPOUNDS THROUGH THE INVOICE.]",
        "[VISUAL: CIRCUIT DIAGRAM on black. Three blue nodes pulse as one loop: Pentagon procurement, Treasury issuance, Gulf recycling. Institutions associated with a multipolar monetary bargain sit at the frame edge and desaturate to gray. Label the center HUB. No faces. No flags except as small node markers.]",
        "[VISUAL: ZOOM IN to the Yangtze and Pearl River deltas. Factory clusters burn white. Container arcs leave for North America and Europe. A return arc of dollar balances splits: one branch buys Gulf crude, the other settles into a bar chart of official Treasury holdings that climbs through the early 2010s and then bends down. China in crimson. Treasury bars in blue.]",
        "[VISUAL: SPLIT BALANCE SHEET. The same stack of Treasuries sits under two headings, RESERVE and HOSTAGE. A slider labeled FREEZE RISK rests near zero. A thin white line connects the stack to a blue icon of American household consumption, labeled MUTUAL VULNERABILITY. The slider does not move yet.]",
        "[VISUAL: A central-bank reserve block geographically over Russia desaturates and locks with a hard blue bracket. Identical pale blocks over other surplus states flicker in sequence. A credibility line on a time-series graph steps down once and does not recover. Amber BRICS nodes brighten by one stop. No explosion, no courtroom.]",
        "[VISUAL: China's blue Treasury bar flattens. Parallel pipes draw themselves in amber: a yuan-clearing rail, a gold allocation, a lattice of central-bank swap lines. New York's correspondent-bank node stays blue and bright. The new pipes route around it and never touch it. Camera drifts along the amber pipes.]",
        "[VISUAL: PAYMENT SCHEMATIC, orthographic. Invoice, correspondent bank, message rail, legal gate. The gate is labeled THE GRIP and glows blue. CUT TO a second schematic of the same oil cargo moving on a bilateral amber rail that bypasses the gate. A small line graph tracks DOLLAR SHARE OF THE MARGINAL BARREL, with a ghost line for the average barrel left deliberately flatter.]",
        "[VISUAL: ZOOM IN on Persian Gulf loading terminals at night. One contract thread, thicker than the others, leaves a single buoy and lands on the Chinese coast in amber, tagged YUAN, with a visible gap where a New York detour would have been. On-screen caption, held: MARGINAL BARREL, NOT THE AVERAGE BARREL. Beneath, a flow diagram shows new Treasury purchases falling through the replacement rate.]",
        "[VISUAL: THREE-PANEL GRAPH, synchronized to the narration. Top, FLOW: new official Treasury buying drops after the yuan contract. Middle, STOCK: the inherited Treasury pile begins a controlled decline. A blue vertical shock labeled CUSTODY THREAT steepens that decline. Bottom panel: amber settlement share rises. Axes unlabeled except for the three titles.]",
        "[VISUAL: A single object, half munition and half Treasury bond, rotates and splits along a seam. Left piece stays blue. Right piece fades. A cost-of-funding line trends up as a foreign-official-demand line trends down. No slogan, no narrator lower-third. Only the two lines on a black field.]",
        "[VISUAL: WORLD MAP, political borders subdued. Allied financial nodes remain blue and stable. China's energy-settlement corridors with a handful of producers glow amber. A glass mirror overlay cracks only along the path factory, barrel, bond. Every other dollar path on the map stays intact. Slow drift, no shake.]",
        "[VISUAL: SLOW ZOOM OUT. The cracked mirror holds center frame. Tariff walls, export-control gates, and sanction lists fade in as thin blue barriers. Amber corridors thicken in response, not everywhere, only on the energy path. The move ends on the marginal barrel, settled outside the mirror, with the Treasury stock quietly declining on a graph beneath. Hold four seconds. Cut to black.]",
    ],
    2: [
        "[TITLE CARD, silent: PREDICTIVE ATLAS, then the episode title. First spoken word begins over a map, not over a host. VISUAL: TOP-DOWN map of the European plain from the Rhine to the Urals. Terrain relief only, no weather. A translucent band across Ukraine is labeled WIDTH. Two pressure arrows, blue from the west and dark red from the east, compress the band. The band thins until it shears.]",
        "[VISUAL: The same plain, now with capability markers rather than speeches. Blue squares for allied military infrastructure step eastward across the former Warsaw Pact. Dark-red markers count air defense, long-range fires, and bases on the Ukrainian steppe. A distance ruler between the two sets of markers is labeled RELATIVE POWER. The ruler shortens. Intentions are never shown as text.]",
        "[VISUAL: TIMELINE with four hard cuts: alliance enlargement after the Cold War; Bucharest, 2008, the sentence on Ukraine and Georgia, no date attached; 2014, Crimea and the Donbas marked as a tear in the band; Minsk documents appear and remain unsigned in practice. By 2022 the width band is a line. Camera does not linger on casualties.]",
        "[VISUAL: A clean institutional blueprint, drawn like an architect's sheet. One Ukrainian outline. Economic arrows in steel gray toward the European Union. Military arrows absent. A verification grid of inspection sites replaces flags. A small inset of postwar Finland, labeled REFERENCE, stays non-aligned and intact. The blueprint is then slid aside, not ripped.]",
        "[VISUAL: GAME BOARD, three players, one object in the center labeled ALIGNMENT. The object does not divide when the cursor tries to split it. Bucharest, the failure of Minsk, and the invasion each remove a player token. With the center empty, the board redraws itself as two territories and a fortified line. Caption: GEOMETRY AFTER THE CENTER FAILS.]",
        "[VISUAL: MAP EQUILIBRIUM B, the default. ZOOM to Crimea. Sevastopol harbor marked as a fleet node in dark red. A land connection and the Donbas belt shade as depth. West of a fortified contact line, Kyiv, the central river cities, and the Polish frontier remain in a steel-gray and pale-amber Ukrainian state, armed from outside. A blue NATO halo stops at the allied border and does not cross. Caption: CONTACT-LINE FREEZE.]",
        "[VISUAL: The Dnieper draws itself as a bright hydrographic line, then switches to a dashed stroke. A cost curve and a security-value curve plot against kilometers west. They intersect on the contact line in the baseline. A second, higher intersection appears on the river only when a cost dial is forced upward. Caption: RIVER LINE IS THE ESCALATION EQUILIBRIUM. Do not animate an advance.]",
        "[VISUAL: Kyiv marked well inside the western polity, with a political-pressure gauge beside it labeled UNRECONCILED. Two columns: DE FACTO PARTITION and DE JURE PROTEST, both occupied. A faded overlay of the single neutral state sits behind them, legible, stamped NOT THE EQUILIBRIUM. No crowd footage.]",
        "[VISUAL: REPEATED GAME diagram. Two arrows labeled CHEAT. A punishment loop labeled RETURN TO WAR with a high cost weight. The ceasefire holds only while a bar titled COST OF CHEATING stays above a bar titled SEASONAL GAIN. Constraints appear as physical objects: a demilitarized band, a range limit on strike systems, monitors whose budget does not grow if the line moves.]",
        "[VISUAL: SPLIT LEDGER. Western reconstruction contracts stack in euros and dollars, with IMF and European institutional seals, and a conditionality stamp on the security file. Eastern fuel, pensions, and trade clear through a dark-red fiscal system. A Black Sea grain corridor is drawn as a thin gold side-payment. When the corridor closes, the gold line vanishes and the game board flips back to pure security.]",
        "[VISUAL: Two columns of text, no narrator on screen. Left, Sachs: multipolar design, inspection, one state. Right, Mearsheimer: a design exists only if the strongest players forgo the alignment. The forward-posture supply arrow from the blue security complex continues into the map. The buffer fills with weapon icons, shown as facts, not as a montage of combat.]",
        "[VISUAL: FINAL MAP, held. Blue alliance territory solid on the Polish, Slovak, Hungarian, and Romanian frontiers. Pale amber and steel gray for the truncated Ukrainian state. A darker band for the eastern and southern territories under Russian force, including the fleet harbor, tied to a separate payment rail. Between them, a thin monitored strip, the last width. The Dnieper remains dashed in the background. Caption, and no other: STABLE UNDER ANARCHY. Hold. Cut to black.]",
    ],
    3: [
        "[TITLE CARD, silent, over black water. VISUAL: SATELLITE VIEW, ZOOM IN to the Strait of Malacca between Sumatra and the Malay Peninsula. Shipping-density heatmap, white-hot in the usable lane near Singapore, cooling toward the approaches. An equation fades in at the lower left: DEFICIT = SOUTHERN FLOW − STOCKS − PACIFIC − PIPELINES. No fleet icons yet.]",
        "[VISUAL: The funnel narrows to a few kilometers of lane. Historical flow ribbons: crude and dry cargo between the Indian Ocean and the Pacific. A 2000s planning card reads FOUR-FIFTHS OF OIL IMPORTS, then a second card shows the fraction lower but still dominant. Middle Eastern and African crude ribbons still enter from the west and exit toward crimson Chinese terminals.]",
        "[VISUAL: Two navies abstracted as valve hands, not as ship models in combat. Blue outer-sea control on the Indian Ocean side. Crimson industrial demand on the Pacific side. The chokepoint is a literal valve graphic. Open lane and closed valve are the same object, recolored. Caption: SECURITY AT A CHOKEPOINT IS ZERO-SUM.]",
        "[VISUAL: The ships remain. A second overlay, institutional, desaturates the fleet and highlights budget lines, allied price spikes, and Gulf producer choices. Amber lines begin to connect Russia, Iran, and selected Gulf nodes into a loose energy coalition. The blue fleet mission box stays funded. The coalition brightens as the mission box pulses.]",
        "[VISUAL: PLANNING CASE, clearly labeled SCENARIO, not a census. A Sankey diagram: eleven million barrels a day of crude imports split into six million southern-strait barrels and five million Pacific-or-land barrels. A dial marked HYPOTHETICAL STOCK, eight hundred million barrels. Two readouts: about seventy days if everything stops; about four months if only the southern six million stop. A footnote on the graph: RATIONING STARTS BEFORE EMPTY.]",
        "[VISUAL: THREE PIPELINE BARS at design capacity. Myanmar, Bay of Bengal to Yunnan, twenty-two million tons a year. Kazakhstan, twenty million. The Russia-China spur into Daqing, thirty million. Sum labeled JUST UNDER 1.5 MILLION BARRELS A DAY. A separate gas bar for Power of Siberia, thirty-eight billion cubic meters, explicitly not plugged into the crude gap. Pacific loadings at Kozmino and trans-Pacific cargoes from the Americas bypass the Indian Ocean entirely and stay lit.]",
        "[VISUAL: ALTERNATE GATES draw on. Sunda, Lombok, and the eastern Indonesian exits take diverted ribbons. Freight and insurance indices tick up. A depth callout shows the largest tankers already preferring deeper water. The camera PULLS BACK from Malacca alone to the whole archipelago. Each added gate lights a third country's coastline. Caption: A REAL CLOSURE MUST PRICE EVERY SOUTHERN GATE.]",
        "[VISUAL: DEMAND-DESTRUCTION SEQUENCE as a stacked priority chart. Diesel for agriculture and the armed forces stays green and protected. Private road fuel drops out. Export petrochemicals drop before household heating. A factory icon idles. Beside it, a currency loop: halted exports cut the foreign exchange used to buy the next cargo. Blue insurance nodes go dark. Remaining cargoes retag amber: yuan, gold, or a bilateral balance.]",
        "[VISUAL: NORTH POLAR PROJECTION. The Northern Sea Route is a thin seasonal thread, ice-class icons, a short calendar window, volume annotated as a rounding error beside Malacca. Gwadar to western China is a thin amber political line with a berth-limit marker and a security-risk hatch. Pipeline utilization needles rise but stop well below the southern deficit. Do not draw these routes thicker than their data.]",
        "[VISUAL: QUARTER TIMELINE, three months, animated as a stock-draw chart. Month one: ships already east of the gates discharge; insurance price spikes. Month two: partial reroute, Pacific Russian barrels, forced pipeline use, south-coast factories on enforced idle. Month three splits into two branches: PACIFIC OPEN, injured and functioning; PACIFIC CLOSED, industrial core contracts. An option-value formula sits under the chart: probability of siege times output lost per month.]",
        "[VISUAL: The month-three branch with Pacific closed pushes a survival gauge on a continental power into the red. Response icons appear as categories only: economic retaliation, pressure on third countries, risk to the blockading fleet. No targeting solution, no weapon cutaway. A Taiwan crisis timeline is shown as the thread on which the energy valve is hung. The valve is labeled ADJUNCT.]",
        "[VISUAL: ALLIED OIL PRICES and shipping-risk indices rise in blue-user states that also depend on the strait. Gulf producers face a fork: forgo Chinese demand, or accept enforcement of their customer. A second-buyer node in crimson stays available. A small inset replays the Episode 1 marginal-barrel contract, now triggered by the siege. Amber invoice share ticks up.]",
        "[VISUAL: CLOSING SPLIT MAP. Left: Malacca-only closure, measured in months, stocks drawing, hulls diverting, pipelines maxed near one and a half million barrels a day, Pacific crude still flowing. Right: southern-plus-Pacific siege, labeled REGIONAL WAR, industrial contraction steep. Beijing's gambit highlights the left map as disappointing and the right map as enormous. Washington's gambit is a threat bracket around both. Hold. Cut to black.]",
    ],
    4: [
        "[TITLE CARD, silent, over a muted aerial of a chemical complex. VISUAL: A two-term equation. SECURITY priced as a blue Washington node. ENERGY priced as a pipeline from Siberia. The energy term is deleted with a hard cut. The security term recolors from a gift icon to a tax icon sitting on a German industrial core. The core's output gauge sags.]",
        "[VISUAL: PRE-BREAK Sankey of German gas imports, more than half from Russia, moving by pipe with three cost steps crossed out: no liquefaction, no ocean leg, no regasification toll. Split end use: boilers and chemical feedstock. A competitor price gap opens versus the United States and China. Then the Baltic pipelines go dark. A small caption: ATTRIBUTION CONTESTED. A larger caption: FLOW IS ZERO.]",
        "[VISUAL: EUROPEAN POWER RANKING, abstract blocks, Germany the largest industrial block inside the continent. A century-scale inset shows repeated external efforts to prevent a durable German-Russian combination, drawn as blocked corridors, not as a war montage. A cap descends: expensive allied energy, hosted forces, sanctions clearance. Factory icons under the cap switch off one by one. Caption: SURVIVAL FOR A TRADING STATE IS THE PRODUCTIVE BASE.]",
        "[VISUAL: The same pipeline, earlier in time, labeled STABILIZER, then relabeled VICE by a blue institutional stamp. Cost bars fall on German chemical employment, eurozone suppliers, and household bills. Gain bars rise for American liquefied-gas exports and for a larger European mission inside the Military-Industrial Complex. A multipolar alternative sheet shows storage, diversification, and contracts, then is filed and not used.]",
        "[VISUAL: LNG PROCESS, clinical. Cool, ship, warm. Coastal terminals at Wilhelmshaven and the other new German sites light up and solve a physical-absence icon. The price regime stays elevated. A political-premium tag hangs on long-term allied cargoes: delay, redirect, diplomatic ask. Professor Jiang's label appears: WEAPONIZED INTERDEPENDENCE. One state supplies the umbrella and can touch the invoice.]",
        "[VISUAL: THREE-TERM DASHBOARD for Berlin. Term one: unit energy cost versus the United States and China. Term two: export revenue, machinery and vehicles, with China among the largest external pools. Term three: insurance value of American protection, including a sealed nuclear file Germany does not open. Weights animate. Formal NATO membership stays a solid blue check. The constraint sliders on terms one and two loosen.]",
        "[VISUAL: DOCUMENTS, not speeches. A secondary-sanctions draft aimed at ordinary industrial sales to China is narrowed by a German pen. A chemical-capacity write-off is postponed. A finance-ministry chart shows the industrial tax base shrinking while a defense-spending pledge stays fixed, the funding gap widening. A loop graphic: security tax reduces the surplus that pays the security tax. Past the cross, the capacity line is chosen.]",
        "[VISUAL: A calendar with no public holiday marked. The crossing is a quarter, defined as the point where the present value of lost chemical, glass, metal, and machine-tool capacity exceeds the present value of umbrella protection. Manifestations, small and technical: a changed default on a license, a brokered gas contract, a refused sanctions line on the auto lane, a eurozone argument. Caption: THE HEDGE IS ASSEMBLED FROM EXCEPTIONS.]",
        "[VISUAL: EUROZONE EXPLODED DIAGRAM. German intermediate goods sit inside Italian, French, and Central European products. A hollow German core propagates as a fiscal event. France's nuclear-heavy power mix stays stable and does not lead. The Commission node stays close to the American file. Two speeds: slow speech in Brussels, faster permissions in Berlin. Euro invoicing and bilateral netting peel a slice of trade off the dollar gate.]",
        "[VISUAL: SIBERIAN GAS as a cost curve, the lowest large piped supply into Central Europe if a route exists. No romantic imagery, no folk motifs. A valve risk is permanent and drawn as a standing red flag. Two answer sheets: the abandoned institutional sheet, storage plus a diverse book plus no single veto; the current realist sheet, allied gas as base load, a managed eastern molecule at the margin, both suppliers marked POWERS.]",
        "[VISUAL: DUAL LOSS diagram. Lose the Chinese market while paying an American energy premium: two downward arrows. Keep the Chinese market: a narrow disappointment inside technology controls. A filter sorts controls: military technology stays blocked in blue; the broad industrial relationship is delayed, narrowed, and interpreted down. Sachs label: HUB OVERREACH. Mearsheimer label: RELATIVE-POWER MAINTENANCE. Both labels remain on screen together.]",
        "[VISUAL: A European coat on a German frame. The coat's claim types itself: a continent without a chemical and machine base is not a defense base, because defense goods are industrial goods. Under the coat, three exception lanes reopen toward Eurasia: energy without a speech, exports without a fight, payments that avoid a dollar gate. The alliance flag and the umbrella remain. Their monopoly over the strategy map does not. Hold. Cut to black.]",
    ],
    5: [
        "[TITLE CARD, silent, over a cleanroom seen only as white light and a grid floor, no proprietary tool detail. VISUAL: A two-cell ranking. INTACT FAB IN THE OTHER SIDE'S HANDS sits below STOPPED FACTORY for both Washington and Beijing. The ranking itself is labeled THE FORTRESS. A peacetime state shows both ecosystems drawing wafers under blue rules. A wartime state flips the asset from prize to denial target.]",
        "[VISUAL: SUPPLY CHAIN as a single narrow spine. One firm, one island, dominant share of the leading-edge logic stack. Upstream: Dutch lithography, American deposition and etch, Japanese materials and optics, each a chokepoint bead. The island is marked contested political real estate. A final caption: WHOEVER SETS ACCESS SETS A SHARE OF FUTURE CAPITAL STOCK. No fab interior tutorial.]",
        "[VISUAL: THREE PROBLEM LAYERS stacked on Taiwan. Layer one: a blue security commitment from a sea power to an island off a continental power. Layer two: a technology monopoly feeding military and economic capability. Layer three: a power transition, intentions shown as sealed envelopes, capabilities shown as open books. Relative compute is added to the relative-power scale. A permanent compute gap is tagged STRATEGIC POSITION.]",
        "[VISUAL: POLICY STACK, blue. Export controls on chips and tools. Subsidies relocating a slice of production to allied soil. A ceiling graphic labeled over the Chinese technology trajectory. The Military-Industrial Complex and the control bureaucracy share one growing program box. A lesson arrow into Beijing: time inside the order equals falling behind. An alternative sheet, commercial access under verified military-end-use limits, stays on the table and is not selected. Wreckage appears only as a priced option, not as a procedure.]",
        "[VISUAL: FOUR-CELL MATRIX. Outcome one, constrained status quo: island fabricating, American tool control, China receiving only what the rules allow, cell shaded favorable to Washington while the long run looks tolerable. Outcome two, capture with operation: workforce stays, yields recover, compute shifts, worst cell for Washington. Outcome three, denial: frontier output stops whoever holds the buildings, relative loser is the side with the weaker substitute. Outcome four, nationalization without capability: flag changes, yields do not return, cell pulled toward denial.]",
        "[VISUAL: SUBSTITUTE BARS, incomplete on purpose. American southwest, Japan, Europe, and Korean leading-edge capacity, a fraction of future demand, delayed by years, below the island's volume and pace. Chinese domestic foundries behind the frontier, plus a stockpile that expires. Trailing nodes fail to reach the leading edge on the graph. A relative-power delta shows Washington losing less under denial than under capture. Beijing's best cell pulses only when the workforce icon is still present.]",
        "[VISUAL: PROBABILITY TREE, abstract. Branch: violent change of control. Sub-branch: low probability that the plant still operates. Grabbing the plant is labeled BUYING DENIAL AT A HIGHER PRICE. Maintenance dependence, a severed foreign tool chain, and scattered process knowledge are shown as three locks, not as instructions. Cleanroom fragility is a single property card: air and vibration. Outcome four unless staff, spares, power, and water are held. The preferred end state if the rival's success is the worst cell: NOBODY GETS A WORKING PLANT.]",
        "[VISUAL: Both capitals place EXCLUSIVE RIVAL CONTROL above SHARED LOSS on an identical card. A probability of capture above zero forces a menu that makes capture worthless. Sachs tags the menu HUBRIS. A yearly tightening of controls is a downward slope labeled RETURN TO WAITING. The institutional bargain, access with verification, is a corridor back to Outcome one. Remove the corridor and the token slides toward the cells where the fabs die.]",
        "[VISUAL: PEACETIME RACE, two tracks. Onshore fabs and domestic Chinese tools each shave the pain of a stoppage without matching the island. A ranking meter moves. When Washington's substitutes cover a military minimum, denial reclassifies from national wound to tolerable emergency. When Beijing reaches the same belief, the deterrent value of denial falls and so does the value of capture. The present is marked DANGEROUS MIDDLE: unique prize, incomplete substitutes.]",
        "[VISUAL: THREE OPTIONS as a menu, coarse by design, no engineering layer underneath. Option one: deterrence, fight looks unpayable, stay in Outcome one. Option two, mainly Beijing in this model: seek control and attempt to run what is captured; the attempt fails if people and the tool chain are gone. Option three, both: treat a working transfer as unacceptable and plan for years of interrupted frontier output. Categories only, as labeled chips: evacuation of specialized labor, legal blocks on servicing, ordinary fragility under fire. A hard caption: NOT A SEQUENCE OF INSTRUCTIONS.]",
        "[VISUAL: AI DEMAND CURVE steepens. More capital competes for the same leading-edge wafers. The prize grows. Capture incentive and denial incentive rise together. A window labeled STATUS QUO STILL DOMINATES narrows. Three prediction tags: Mearsheimer, the window is a power fact; Sachs, the controls convince the other side the window is a cage; Jiang, a numeric crossover where the expected value of capture, cut by the low probability of a working plant, falls below the expected value of denial.]",
        "[VISUAL: THE FORTRESS REDRAWN. It is not a wall around the island. It is a preference ordering around a factory. Blue nodes in the Netherlands, Japan, Korea, and the United States: tool masters and incomplete substitutes. Amber mainland effort: trailing second source. The island between them, immensely productive. A single switch labeled DETERRENCE FAILED flips both capitals from possession to prevention at once. Final comparison, held in silence after the last line: rubble in a cleanroom against output in the rival's arsenal. Cut to black.]",
    ],
}


def spoken_words(text: str) -> int:
    kept = []
    for block in text.split("\n\n"):
        stripped = block.strip()
        if not stripped or stripped.startswith("["):
            continue
        if stripped.startswith("PREDICTIVE ATLAS") or stripped.startswith("EPISODE"):
            continue
        if stripped.startswith("SPOKEN NARRATION") or stripped.startswith("READ"):
            continue
        if stripped.startswith("TITLE:"):
            continue
        kept.append(stripped)
    return len(" ".join(kept).split())


def main() -> None:
    for n, cues in CUES.items():
        narration = (ROOT / f"episode-0{n}-narration.txt").read_text().strip()
        paras = [p.strip() for p in narration.split("\n\n") if p.strip()]
        if len(paras) != len(cues):
            raise SystemExit(f"Episode {n}: {len(paras)} paragraphs, {len(cues)} cues")
        series, title = HEADERS[n]
        parts = [
            "PREDICTIVE ATLAS",
            series,
            f"TITLE: {title}",
            "",
            "SPOKEN NARRATION: 1,500 words. Read only the unbracketed paragraphs.",
            "READ the bracketed blocks as silence. They are animation direction.",
            "PACE: cold, level, unhurried. No greeting. No moral lift at the close.",
            "TARGET DURATION: about 11 minutes at a measured 135 words per minute.",
            "",
            "[TITLE CARD, silent, three seconds: PREDICTIVE ATLAS, then the episode title in small caps. No host. Cut to picture on the first spoken word.]",
            "",
        ]
        for para, cue in zip(paras, cues):
            if cue.startswith("[TITLE CARD"):
                cue = "[VISUAL:" + cue.split("VISUAL:", 1)[1]
            parts.append(para)
            parts.append("")
            parts.append(cue)
            parts.append("")
        body = "\n".join(parts).rstrip() + "\n"
        out = ROOT / f"episode-0{n}-script.txt"
        out.write_text(body)
        count = spoken_words(body)
        print(f"{out.name}: spoken {count}")


if __name__ == "__main__":
    main()
