import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type QuestionType = "tfng" | "mcq" | "sentence_completion" | "short_answer";
type SetType = QuestionType | "mixed";

type BaseQuestion = {
  id: number;
  order_index: number;
  question_type_index: QuestionType;
  question_type_label: string;
  prompt: string;
  payload: Record<string, unknown>;
};

type BaseAnswer = {
  question_id: number;
  answer_type: "label" | "option_key" | "text";
  answer_value: string;
  accepted_values?: string[];
  explanation: string;
};

type RawCard = {
  index: number;
  type: SetType;
  title: string;
  topic_index: string;
  passage: string;
  questions: BaseQuestion[];
  answer_key: BaseAnswer[];
};

const SET_LABEL: Record<SetType, string> = {
  tfng: "True / False / Not Given",
  mcq: "Multiple Choice",
  sentence_completion: "Sentence Completion",
  short_answer: "Short Answer",
  mixed: "Mixed",
};

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}

const cards: RawCard[] = [
  {
    index: 121,
    type: "tfng",
    title: "Continental Drift Before Plate Tectonics",
    topic_index: "history_of_science/continental_drift_before_plate_tectonics",
    passage:
      "Wegener’s continental drift hypothesis was not dismissed simply because the continents failed to fit together visually, but because he lacked a convincing mechanism for their movement. Fossil distributions, rock formations, and continental outlines made the idea suggestive, yet suggestive evidence was not enough to secure acceptance. Later plate tectonics supplied a broader framework that made continental motion physically intelligible. The episode shows that a scientific claim can be partly supported while still awaiting a mechanism strong enough to make it persuasive.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Wegener’s hypothesis was rejected simply because the shapes of the continents did not match convincingly.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Wegener’s idea had some supporting evidence, but this did not fully overcome doubts about how continents could move.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage states that Wegener’s hypothesis was rejected mainly because he lacked academic authority.",
        payload: {},
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Plate tectonics later made continental movement more physically plausible.",
        payload: {},
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: "FALSE",
        explanation:
          "The passage says rejection was not simply about visual fit; mechanism was the main problem.",
      },
      {
        question_id: 2,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "Supporting evidence existed, but it was not enough without a convincing movement mechanism.",
      },
      {
        question_id: 3,
        answer_type: "label",
        answer_value: "NOT GIVEN",
        explanation:
          "The passage does not mention academic authority as the reason for rejection.",
      },
      {
        question_id: 4,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The third sentence says plate tectonics later made continental motion physically intelligible.",
      },
    ],
  },
  {
    index: 122,
    type: "tfng",
    title: "Octopus Intelligence",
    topic_index: "animal_cognition/octopus_intelligence",
    passage:
      "Octopus intelligence is difficult to compare with mammalian intelligence because it evolved in a body plan and nervous system organized very differently from our own. Problem-solving, camouflage, exploration, and flexible arm control suggest sophisticated behaviour, but they do not simply map onto human-like cognition. The animal’s distributed nervous system complicates any assumption that intelligence must be centralized in a brain resembling a vertebrate one. Its significance therefore lies in expanding what intelligence can look like, not in ranking octopuses as imperfect mammals.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage argues that octopus behaviour should be understood as a less developed version of mammalian cognition.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says camouflage is a better indicator of intelligence than problem-solving.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The distributed nervous system of octopuses challenges brain-centred assumptions about intelligence.",
        payload: {},
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Octopus intelligence is difficult to evaluate using models based on mammalian or vertebrate intelligence.",
        payload: {},
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: "FALSE",
        explanation:
          "The passage rejects ranking octopuses as imperfect mammals.",
      },
      {
        question_id: 2,
        answer_type: "label",
        answer_value: "NOT GIVEN",
        explanation:
          "Camouflage and problem-solving are both listed without ranking one as better.",
      },
      {
        question_id: 3,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The third sentence directly says distributed nervous systems challenge centralized-brain assumptions.",
      },
      {
        question_id: 4,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The first sentence emphasizes major differences from mammalian intelligence models.",
      },
    ],
  },
  {
    index: 123,
    type: "tfng",
    title: "The Camera Obscura",
    topic_index: "history_of_optics/camera_obscura",
    passage:
      "The camera obscura did not make visual truth automatic; it altered how observers could project, trace, and analyse scenes. Artists and scientists used it to discipline vision, but interpretation still shaped what was selected, framed, and trusted. Its significance lies in mediating observation rather than replacing the observer. The device shows that instruments can sharpen perception while also reorganizing the conditions under which seeing counts as evidence.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The camera obscura could strengthen observation while also shaping what counted as reliable evidence.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says scientists adopted the camera obscura before artists did.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage suggests that the device made human interpretation unnecessary.",
        payload: {},
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The camera obscura changed the conditions under which visual scenes could be studied.",
        payload: {},
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The final sentence states that instruments can sharpen perception and reshape evidential conditions.",
      },
      {
        question_id: 2,
        answer_type: "label",
        answer_value: "NOT GIVEN",
        explanation: "No adoption order between artists and scientists is provided.",
      },
      {
        question_id: 3,
        answer_type: "label",
        answer_value: "FALSE",
        explanation:
          "The second sentence says interpretation still shaped selection and trust.",
      },
      {
        question_id: 4,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The first and final sentences indicate changed observational conditions.",
      },
    ],
  },
  {
    index: 124,
    type: "tfng",
    title: "Keystone Species",
    topic_index: "ecology/keystone_species",
    passage:
      "Keystone species are not necessarily the most abundant organisms in an ecosystem; their importance lies in how disproportionately they shape ecological relationships. Removing such a species can trigger cascading changes, but the severity depends on context, food-web structure, and functional redundancy. The concept is useful because it shifts attention from simple headcounts to ecological roles. It does not imply that only one species matters, but that some roles hold systems together more than their numbers suggest.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt: "The passage says keystone species are usually predators.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Functional redundancy can influence how severe the loss of a keystone species becomes.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage suggests keystone species always have the same level of impact when removed.",
        payload: {},
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "A species may be ecologically important even if it is not numerically dominant.",
        payload: {},
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: "NOT GIVEN",
        explanation: "Predator status is not specified in the passage.",
      },
      {
        question_id: 2,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The second sentence explicitly lists functional redundancy as a severity factor.",
      },
      {
        question_id: 3,
        answer_type: "label",
        answer_value: "FALSE",
        explanation:
          "The passage says impacts depend on context and food-web structure.",
      },
      {
        question_id: 4,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The first sentence says importance is about role, not abundance.",
      },
    ],
  },
  {
    index: 125,
    type: "tfng",
    title: "Bletchley Park and Secrecy",
    topic_index: "history_of_intelligence/bletchley_park_secrecy",
    passage:
      "Bletchley Park’s wartime value lay not only in breaking messages but in turning decrypted fragments into intelligence usable under severe secrecy. The work depended on mathematicians, linguists, clerks, machine operators, and military channels, so the achievement was institutional as well as intellectual. Continued secrecy after the war delayed public recognition, but it also shaped which participants’ contributions became visible first. Its history therefore complicates heroic accounts that reduce codebreaking to a few famous minds.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says women’s contributions were recognised before those of mathematicians.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage suggests that codebreaking success depended only on mathematical brilliance.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage presents Bletchley Park’s achievement as both collaborative and organisational.",
        payload: {},
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Secrecy influenced how quickly and whose contributions became publicly recognised.",
        payload: {},
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: "NOT GIVEN",
        explanation:
          "No comparison is made between women’s and mathematicians’ recognition timing.",
      },
      {
        question_id: 2,
        answer_type: "label",
        answer_value: "FALSE",
        explanation:
          "The passage stresses multi-role institutional collaboration, not math alone.",
      },
      {
        question_id: 3,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "Sentence two describes institutional and intellectual cooperation across roles.",
      },
      {
        question_id: 4,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "Sentence three directly states secrecy delayed and shaped visibility of contributions.",
      },
    ],
  },
  {
    index: 126,
    type: "tfng",
    title: "Elephants as Ecosystem Engineers",
    topic_index: "ecology/elephants_ecosystem_engineers",
    passage:
      "Elephants are often described through their size or intelligence, but ecologists also view them as ecosystem engineers. By opening woodland, dispersing seeds, and digging for water, they can alter habitats used by many other species. These effects are not automatically beneficial in every place, because conservation outcomes depend on density, landscape history, and human land use. Their ecological importance therefore lies in their capacity to reorganize environments, not in a simple assumption that more elephants always improve biodiversity.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage assumes that increasing elephant numbers always improves biodiversity.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Elephants can alter environments in ways that affect other species.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says seed dispersal is the main reason elephants are considered intelligent.",
        payload: {},
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The ecological effects of elephants may depend partly on human land use.",
        payload: {},
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: "FALSE",
        explanation:
          "The final sentence rejects the idea that more elephants always improve biodiversity.",
      },
      {
        question_id: 2,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The second sentence lists several ways elephants alter habitats for other species.",
      },
      {
        question_id: 3,
        answer_type: "label",
        answer_value: "NOT GIVEN",
        explanation:
          "Seed dispersal is discussed as ecological engineering, not as proof of intelligence.",
      },
      {
        question_id: 4,
        answer_type: "label",
        answer_value: "TRUE",
        explanation:
          "The third sentence includes human land use as a dependency factor.",
      },
    ],
  },
  {
    index: 127,
    type: "mcq",
    title: "The Little Ice Age",
    topic_index: "climate_history/little_ice_age",
    passage:
      "The Little Ice Age is best understood not as a single uniform freeze but as a period of regional climatic variability marked by cooler episodes in parts of the Northern Hemisphere. Its social effects depended on agriculture, trade, political institutions, and local capacity to absorb harvest shocks. A cold decade could become a crisis in one region while remaining manageable in another. The concept is useful only if climate is treated as a pressure interacting with society rather than as an independent script for history.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What misconception about the Little Ice Age does the passage mainly challenge?",
        payload: {
          options: [
            {
              key: "A",
              text: "That climate had no influence on historical societies",
            },
            {
              key: "B",
              text: "That cooler episodes occurred only outside the Northern Hemisphere",
            },
            {
              key: "C",
              text: "That it was a uniform climatic event with identical social consequences everywhere",
            },
            {
              key: "D",
              text: "That agricultural systems were the only factor affected by colder conditions",
            },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "According to the passage, why might the same cold decade produce different outcomes in different regions?",
        payload: {
          options: [
            {
              key: "A",
              text: "Some regions were better able to absorb harvest-related pressures.",
            },
            {
              key: "B",
              text: "Trade networks prevented climate from affecting food supply.",
            },
            {
              key: "C",
              text: "Political institutions mattered only after agricultural collapse had already occurred.",
            },
            {
              key: "D",
              text: "Climate affected temperature but not social stability.",
            },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What does the phrase “an independent script for history” suggest?",
        payload: {
          options: [
            {
              key: "A",
              text: "A historical explanation in which climate alone determines social outcomes",
            },
            {
              key: "B",
              text: "A written record showing how societies adapted to colder decades",
            },
            {
              key: "C",
              text: "A theory that excludes agriculture and trade from climate history",
            },
            {
              key: "D",
              text: "A method of studying climate without reference to regional evidence",
            },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "Which heading best captures the passage?",
        payload: {
          options: [
            { key: "A", text: "The Little Ice Age as a Global Freeze" },
            {
              key: "B",
              text: "Climate Pressure and Uneven Historical Consequences",
            },
            {
              key: "C",
              text: "How Agriculture Replaced Climate in Historical Explanation",
            },
            {
              key: "D",
              text: "The Northern Hemisphere’s Complete Climatic Collapse",
            },
          ],
        },
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "option_key",
        answer_value: "C",
        explanation:
          "The first sentence rejects the idea of a uniform freeze with identical effects.",
      },
      {
        question_id: 2,
        answer_type: "option_key",
        answer_value: "A",
        explanation:
          "The second sentence highlights local capacity to absorb harvest shocks.",
      },
      {
        question_id: 3,
        answer_type: "option_key",
        answer_value: "A",
        explanation:
          "The phrase implies deterministic climate-only historical explanation.",
      },
      {
        question_id: 4,
        answer_type: "option_key",
        answer_value: "B",
        explanation: "This heading captures climate pressure plus uneven outcomes.",
      },
    ],
  },
  {
    index: 128,
    type: "mcq",
    title: "The Electric Telegraph",
    topic_index: "technology_history/electric_telegraph",
    passage:
      "The electric telegraph did not merely accelerate messages; it changed the relationship between information and distance. Markets, newspapers, railways, and governments could coordinate actions before physical movement occurred. This did not make geography irrelevant, since wires, stations, prices, and political control shaped who could communicate. Its significance lies in separating communication from transport while creating new infrastructures of access and exclusion.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What central change does the passage associate with the electric telegraph?",
        payload: {
          options: [
            {
              key: "A",
              text: "It allowed information to guide decisions before people or goods physically moved.",
            },
            {
              key: "B",
              text: "It removed the need for railways, newspapers, and government communication.",
            },
            {
              key: "C",
              text: "It made distance irrelevant by eliminating the need for physical infrastructure.",
            },
            {
              key: "D",
              text: "It gave all groups equal access to long-distance communication.",
            },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Why did geography continue to matter after the telegraph?",
        payload: {
          options: [
            {
              key: "A",
              text: "Messages still had to be carried mainly by travellers over long distances.",
            },
            {
              key: "B",
              text: "Telegraph systems depended on material networks, costs, stations, and political control.",
            },
            {
              key: "C",
              text: "Newspapers became unable to respond quickly to events.",
            },
            {
              key: "D",
              text: "Markets stopped relying on information from distant places.",
            },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What does “new infrastructures of access and exclusion” suggest?",
        payload: {
          options: [
            {
              key: "A",
              text: "The telegraph expanded communication while also creating unequal access to it.",
            },
            {
              key: "B",
              text: "The telegraph made communication independent of all physical systems.",
            },
            {
              key: "C",
              text: "The telegraph allowed private users to avoid political control entirely.",
            },
            {
              key: "D",
              text: "The telegraph made older transport networks unnecessary.",
            },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Which heading best captures the passage?",
        payload: {
          options: [
            { key: "A", text: "The Telegraph and the Reorganisation of Distance" },
            {
              key: "B",
              text: "Why the Telegraph Ended the Importance of Geography",
            },
            { key: "C", text: "Communication Without Infrastructure or Control" },
            {
              key: "D",
              text: "The Telegraph as a Replacement for Physical Movement",
            },
          ],
        },
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "option_key",
        answer_value: "A",
        explanation:
          "Sentence two shows coordination before physical movement.",
      },
      {
        question_id: 2,
        answer_type: "option_key",
        answer_value: "B",
        explanation:
          "Sentence three lists wires, stations, prices, and political control.",
      },
      {
        question_id: 3,
        answer_type: "option_key",
        answer_value: "A",
        explanation:
          "The phrase indicates expansion with unequal access.",
      },
      {
        question_id: 4,
        answer_type: "option_key",
        answer_value: "A",
        explanation: "This heading best summarizes the distance/infrastructure argument.",
      },
    ],
  },
  {
    index: 129,
    type: "mcq",
    title: "Whale Song and Animal Culture",
    topic_index: "animal_behavior/whale_song_animal_culture",
    passage:
      "Whale song is scientifically important not simply because it is complex, but because some patterns are learned, modified, and transmitted across groups. This makes certain vocal behaviours look less like fixed instinct and more like socially mediated tradition. Yet calling this “culture” requires caution, because human cultural categories cannot be imported without adjustment. The significance lies in widening the study of animal communication while testing how far our concepts can travel.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "Why is whale song scientifically significant according to the passage?",
        payload: {
          options: [
            {
              key: "A",
              text: "It shows that whales possess a form of language equivalent to human speech.",
            },
            {
              key: "B",
              text: "It suggests that some whale vocal behaviours may be socially learned and transmitted.",
            },
            {
              key: "C",
              text: "It proves that instinct plays no role in whale communication.",
            },
            {
              key: "D",
              text: "It demonstrates that animal culture should be defined exactly like human culture.",
            },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "Why does the passage recommend caution when using the term “culture”?",
        payload: {
          options: [
            { key: "A", text: "Whale song is too simple to be studied as a meaningful behaviour." },
            { key: "B", text: "Learned behaviour cannot be reliably observed in animals." },
            { key: "C", text: "Concepts developed for humans may need modification before being applied to whales." },
            { key: "D", text: "Social transmission has been disproved as an explanation for whale song." },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What does the passage suggest about concepts borrowed from human culture?",
        payload: {
          options: [
            { key: "A", text: "They can be useful, but their limits must be carefully tested." },
            { key: "B", text: "They should be completely abandoned in the study of animals." },
            { key: "C", text: "They prove that whales and humans think in the same way." },
            { key: "D", text: "They are relevant only to language, not to communication." },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Which heading best captures the passage?",
        payload: {
          options: [
            { key: "A", text: "Whale Song as Evidence of Human-Like Language" },
            { key: "B", text: "Whale Song, Social Learning, and the Limits of “Culture”" },
            { key: "C", text: "Why Whale Communication Is Purely Instinctive" },
            { key: "D", text: "The End of Human Concepts in Animal Studies" },
          ],
        },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "option_key", answer_value: "B", explanation: "Sentence one highlights learned and transmitted patterns." },
      { question_id: 2, answer_type: "option_key", answer_value: "C", explanation: "Sentence three warns that human categories need adjustment." },
      { question_id: 3, answer_type: "option_key", answer_value: "A", explanation: "The final sentence encourages testing concept limits." },
      { question_id: 4, answer_type: "option_key", answer_value: "B", explanation: "This heading captures both social learning and conceptual caution." },
    ],
  },
  {
    index: 130,
    type: "mcq",
    title: "Apollo Lunar Samples",
    topic_index: "space_science/apollo_lunar_samples",
    passage:
      "Moon rocks brought back by Apollo did more than confirm that humans had reached the lunar surface; they turned the Moon into a laboratory object that could be measured on Earth. Their chemistry and ages helped reconstruct lunar formation and the history of impacts in the early Solar System. Yet samples from specific landing sites could not represent every lunar environment equally. Their importance lies in converting exploration into evidence while leaving room for later missions to broaden the sample.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "What did Apollo lunar samples make possible?",
        payload: {
          options: [
            { key: "A", text: "Scientific analysis of lunar material under laboratory conditions on Earth" },
            { key: "B", text: "Complete knowledge of every geological environment on the Moon" },
            { key: "C", text: "Proof that lunar rocks and terrestrial rocks formed in identical conditions" },
            { key: "D", text: "The permanent resolution of all debates about the Moon’s origin" },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "What limitation does the passage identify about the samples?",
        payload: {
          options: [
            { key: "A", text: "They could not be studied once removed from the lunar surface." },
            { key: "B", text: "They represented particular landing sites rather than the entire Moon equally." },
            { key: "C", text: "They were useful only as proof that astronauts had reached the Moon." },
            { key: "D", text: "They provided no evidence about the early Solar System." },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What does the phrase “converting exploration into evidence” mean in the passage?",
        payload: {
          options: [
            { key: "A", text: "Physical exploration produced material that could be analysed and used scientifically." },
            { key: "B", text: "Exploration became more important than laboratory measurement." },
            { key: "C", text: "Scientific evidence was no longer necessary once lunar travel had succeeded." },
            { key: "D", text: "Later missions became unnecessary because the first samples were complete." },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Which heading best captures the passage?",
        payload: {
          options: [
            { key: "A", text: "Apollo Samples: Scientific Evidence and Its Boundaries" },
            { key: "B", text: "Why Moon Rocks Ended Lunar Exploration" },
            { key: "C", text: "The Moon as a Fully Known Laboratory Object" },
            { key: "D", text: "Human Travel as a Substitute for Scientific Measurement" },
          ],
        },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "option_key", answer_value: "A", explanation: "Sentence one says samples enabled laboratory measurement on Earth." },
      { question_id: 2, answer_type: "option_key", answer_value: "B", explanation: "Sentence three states site-limited representativeness." },
      { question_id: 3, answer_type: "option_key", answer_value: "A", explanation: "Exploration produced analyzable physical evidence." },
      { question_id: 4, answer_type: "option_key", answer_value: "A", explanation: "This heading captures value plus limits of sample coverage." },
    ],
  },
  {
    index: 131,
    type: "mcq",
    title: "The Magnetic Compass",
    topic_index: "navigation_history/magnetic_compass",
    passage:
      "The magnetic compass did not remove uncertainty from navigation; it changed how uncertainty could be managed when landmarks or stars were unavailable. Its value depended on practical knowledge of variation, local conditions, and integration with other methods such as charts and dead reckoning. By making direction portable, the compass altered maritime confidence without making voyages automatic. Its historical role is best understood as a tool that expanded navigational possibility rather than as a device that solved navigation by itself.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "What does the passage mainly argue about the compass?",
        payload: {
          options: [
            { key: "A", text: "It helped navigators manage uncertainty rather than eliminating it entirely." },
            { key: "B", text: "It replaced charts, landmarks, and dead reckoning as navigational methods." },
            { key: "C", text: "It worked independently of local conditions and human interpretation." },
            { key: "D", text: "It made long-distance voyages automatic and largely risk-free." },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Why did other navigational knowledge remain necessary?",
        payload: {
          options: [
            { key: "A", text: "The compass was useful only when visible stars were available." },
            { key: "B", text: "Mariners still had to interpret compass direction alongside variation, conditions, and other methods." },
            { key: "C", text: "Direction could not become portable before the invention of modern charts." },
            { key: "D", text: "The compass reduced maritime confidence in unfamiliar waters." },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "What is implied by “without making voyages automatic”?",
        payload: {
          options: [
            { key: "A", text: "The compass improved navigation but did not remove the need for judgement and skill." },
            { key: "B", text: "Voyages became impossible unless sailors ignored older navigational techniques." },
            { key: "C", text: "The compass failed to offer any practical advantage to mariners." },
            { key: "D", text: "Maritime confidence depended entirely on the availability of landmarks." },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Which heading best captures the passage?",
        payload: {
          options: [
            { key: "A", text: "The Compass and the Management of Navigational Risk" },
            { key: "B", text: "Direction Without Human Skill" },
            { key: "C", text: "The End of Maritime Uncertainty" },
            { key: "D", text: "Why Charts and Dead Reckoning Disappeared" },
          ],
        },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "option_key", answer_value: "A", explanation: "The first sentence states uncertainty was managed, not removed." },
      { question_id: 2, answer_type: "option_key", answer_value: "B", explanation: "The second sentence lists variation, local conditions, and other methods." },
      { question_id: 3, answer_type: "option_key", answer_value: "A", explanation: "It implies better navigation without eliminating human judgement." },
      { question_id: 4, answer_type: "option_key", answer_value: "A", explanation: "This heading best matches the passage’s central claim." },
    ],
  },
  {
    index: 132,
    type: "mcq",
    title: "Fungi and Forest Networks",
    topic_index: "forest_ecology/fungi_and_forest_networks",
    passage:
      "Mycorrhizal fungi are sometimes popularized as if forests were conscious communication networks, but the scientific significance is more precise. Fungi can mediate exchanges of nutrients and influence plant competition, yet these interactions are shaped by species, soil, stress, and evolutionary interest rather than simple cooperation. The concept matters because it complicates the image of plants as isolated individuals. It does not turn a forest into a single organism, but it reveals hidden relationships below ground.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "What popular interpretation does the passage challenge?",
        payload: {
          options: [
            { key: "A", text: "That fungal relationships can influence exchanges of nutrients" },
            { key: "B", text: "That forests should be understood as conscious communication networks" },
            { key: "C", text: "That plant interactions can be affected by soil and stress" },
            { key: "D", text: "That below-ground relationships can alter plant competition" },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "How does the passage describe fungal interactions?",
        payload: {
          options: [
            { key: "A", text: "As context-dependent relationships shaped by species, soil, stress, and evolutionary interest" },
            { key: "B", text: "As evidence that forests operate as unified conscious organisms" },
            { key: "C", text: "As simple cooperation that benefits all plants equally" },
            { key: "D", text: "As proof that competition between plants is scientifically outdated" },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What does the passage suggest is valuable about the mycorrhizal concept?",
        payload: {
          options: [
            { key: "A", text: "It shows that plants are connected in ways that challenge the idea of complete isolation." },
            { key: "B", text: "It proves that cooperation is more important than competition in all forests." },
            { key: "C", text: "It removes the need to study individual species or soil conditions." },
            { key: "D", text: "It confirms that forests communicate intentionally like human societies." },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Which heading best captures the passage?",
        payload: {
          options: [
            { key: "A", text: "Mycorrhizal Fungi and the Limits of the Network Metaphor" },
            { key: "B", text: "Forests as Conscious Underground Societies" },
            { key: "C", text: "Why Fungi Eliminate Plant Competition" },
            { key: "D", text: "Nutrient Exchange Without Ecological Complexity" },
          ],
        },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "option_key", answer_value: "B", explanation: "Sentence one challenges the conscious-network popularization." },
      { question_id: 2, answer_type: "option_key", answer_value: "A", explanation: "Sentence two describes context-dependent ecological interactions." },
      { question_id: 3, answer_type: "option_key", answer_value: "A", explanation: "Sentence three says the concept complicates plant isolation." },
      { question_id: 4, answer_type: "option_key", answer_value: "A", explanation: "This heading captures both value and caution of the concept." },
    ],
  },
  {
    index: 133,
    type: "sentence_completion",
    title: "Photosynthesis and Atmospheric Change",
    topic_index: "earth_history/photosynthesis_atmospheric_change",
    passage:
      "Photosynthesis is often introduced as a process by which plants make food, but its planetary significance lies in linking light energy to atmospheric chemistry. Oxygenic photosynthesis transformed Earth by releasing oxygen as a by-product, gradually altering oceans, rocks, and the air. This change did not simply benefit all existing life, since oxygen was toxic to many organisms adapted to earlier conditions. The process therefore illustrates how biological innovation can reshape environments before those environments become hospitable to later forms of life.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Some earlier organisms were harmed because they could not tolerate ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "The passage presents photosynthesis as important not only for plants, but also for atmospheric ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "The passage uses photosynthesis to show that biological change can reshape ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Oxygenic photosynthesis changed Earth partly because oxygen was released as a ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "text",
        answer_value: "oxygen",
        accepted_values: ["oxygen"],
        explanation: "Sentence three says oxygen was toxic to many earlier organisms.",
      },
      {
        question_id: 2,
        answer_type: "text",
        answer_value: "chemistry",
        accepted_values: ["chemistry", "atmospheric chemistry"],
        explanation: "Sentence one links photosynthesis to atmospheric chemistry.",
      },
      {
        question_id: 3,
        answer_type: "text",
        answer_value: "environments",
        accepted_values: ["environments"],
        explanation: "The final sentence says biological innovation can reshape environments.",
      },
      {
        question_id: 4,
        answer_type: "text",
        answer_value: "by-product",
        accepted_values: ["by-product", "a by-product"],
        explanation: "Sentence two states oxygen was released as a by-product.",
      },
    ],
  },
  {
    index: 134,
    type: "sentence_completion",
    title: "Kepler and Planetary Motion",
    topic_index: "history_of_astronomy/kepler_planetary_motion",
    passage:
      "Kepler’s laws mattered because they replaced ideal circular motion with mathematical descriptions that better matched planetary paths. Elliptical orbits did not make the heavens less orderly; they changed what kind of order astronomers were willing to recognize. The laws connected observation with geometry while leaving the physical cause of motion to be explained later. Their importance lies in disciplining astronomical theory through measured irregularity rather than inherited perfection.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt: "Kepler’s laws connected observation with ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "The passage contrasts measured irregularity with inherited ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Kepler’s laws replaced ideal circular motion with mathematical ______.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Elliptical orbits changed the kind of ______ astronomers accepted.",
        payload: { max_words: 2, instruction_label: "NO MORE THAN TWO WORDS" },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "text", answer_value: "geometry", accepted_values: ["geometry"], explanation: "Sentence three connects observation with geometry." },
      { question_id: 2, answer_type: "text", answer_value: "perfection", accepted_values: ["perfection"], explanation: "The final sentence contrasts irregularity with inherited perfection." },
      { question_id: 3, answer_type: "text", answer_value: "descriptions", accepted_values: ["descriptions"], explanation: "Sentence one says Kepler used mathematical descriptions." },
      { question_id: 4, answer_type: "text", answer_value: "order", accepted_values: ["order"], explanation: "Sentence two says elliptical orbits changed accepted order." },
    ],
  },
  {
    index: 135,
    type: "short_answer",
    title: "Mary Anning and Fossil Evidence",
    topic_index: "history_of_geology/mary_anning_fossil_evidence",
    passage:
      "Mary Anning’s fossil discoveries mattered not only because they revealed spectacular extinct animals, but because they made deep time harder to ignore. Marine reptiles preserved in stone challenged assumptions that past life closely resembled the present world. Her work fed scientific debates even when social class and gender limited her formal recognition. The significance of her discoveries lies in how material evidence forced intellectual change from outside established authority.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt:
          "Which two social factors limited her formal recognition?",
        payload: {
          max_words: 3,
          instruction_label: "NO MORE THAN THREE WORDS",
          case_sensitive: false,
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What broader idea did Anning’s discoveries make harder to ignore?",
        payload: {
          max_words: 3,
          instruction_label: "NO MORE THAN THREE WORDS",
          case_sensitive: false,
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What did material evidence force?",
        payload: {
          max_words: 3,
          instruction_label: "NO MORE THAN THREE WORDS",
          case_sensitive: false,
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What preserved animals challenged assumptions about past life?",
        payload: {
          max_words: 3,
          instruction_label: "NO MORE THAN THREE WORDS",
          case_sensitive: false,
        },
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "text",
        answer_value: "class and gender",
        accepted_values: ["class and gender", "social class and gender"],
        explanation: "Sentence three says social class and gender limited recognition.",
      },
      {
        question_id: 2,
        answer_type: "text",
        answer_value: "deep time",
        accepted_values: ["deep time"],
        explanation: "Sentence one says her discoveries made deep time harder to ignore.",
      },
      {
        question_id: 3,
        answer_type: "text",
        answer_value: "intellectual change",
        accepted_values: ["intellectual change"],
        explanation: "The final sentence says material evidence forced intellectual change.",
      },
      {
        question_id: 4,
        answer_type: "text",
        answer_value: "marine reptiles",
        accepted_values: ["marine reptiles"],
        explanation: "Sentence two identifies marine reptiles preserved in stone.",
      },
    ],
  },
  {
    index: 136,
    type: "short_answer",
    title: "The Great Oxygenation Event",
    topic_index: "earth_history/great_oxygenation_event",
    passage:
      "The Great Oxygenation Event did not merely add a useful gas to the atmosphere; it transformed the chemical conditions of the planet. Oxygen reacted with minerals, altered ocean chemistry, and created a crisis for organisms unable to tolerate it. Only later did oxygen-rich conditions support new metabolic possibilities. The event therefore shows that environmental change can be destructive before becoming enabling.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What did oxygen create for organisms unable to tolerate it?",
        payload: { max_words: 3, instruction_label: "NO MORE THAN THREE WORDS", case_sensitive: false },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What did oxygen-rich conditions later support?",
        payload: { max_words: 3, instruction_label: "NO MORE THAN THREE WORDS", case_sensitive: false },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What did oxygen react with after its atmospheric increase?",
        payload: { max_words: 3, instruction_label: "NO MORE THAN THREE WORDS", case_sensitive: false },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What did oxygen alter besides minerals?",
        payload: { max_words: 3, instruction_label: "NO MORE THAN THREE WORDS", case_sensitive: false },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "text", answer_value: "a crisis", accepted_values: ["a crisis", "crisis"], explanation: "Sentence two says oxygen created a crisis for intolerant organisms." },
      { question_id: 2, answer_type: "text", answer_value: "new metabolic possibilities", accepted_values: ["new metabolic possibilities"], explanation: "Sentence three states this directly." },
      { question_id: 3, answer_type: "text", answer_value: "minerals", accepted_values: ["minerals"], explanation: "Sentence two says oxygen reacted with minerals." },
      { question_id: 4, answer_type: "text", answer_value: "ocean chemistry", accepted_values: ["ocean chemistry"], explanation: "Sentence two says oxygen altered ocean chemistry." },
    ],
  },
  {
    index: 137,
    type: "mixed",
    title: "Göbekli Tepe and Social Complexity",
    topic_index: "archaeology/gobekli_tepe_social_complexity",
    passage:
      "Göbekli Tepe is often discussed because its monumental structures complicate simple models in which settled farming must precede large-scale ritual building. The site does not prove that agriculture was irrelevant to social complexity, but it suggests that ritual cooperation may have helped organize communities before or during transitions to farming. Its significance lies in disturbing a neat sequence rather than replacing one universal story with another. Archaeology here becomes less about finding a single first cause than reconstructing overlapping changes in subsistence, belief, and social organization.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says Göbekli Tepe proves that agriculture played no part in social complexity.",
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "What does the passage suggest about ritual cooperation?",
        payload: {
          options: [
            { key: "A", text: "It may have helped organise communities around the transition to farming." },
            { key: "B", text: "It proves that agriculture was irrelevant to the development of social complexity." },
            { key: "C", text: "It replaced subsistence change as the only cause of early social organization." },
            { key: "D", text: "It occurred only after settled farming had already become fully established." },
          ],
        },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt:
          "Name ONE type of overlapping change archaeology must reconstruct in this case.",
        payload: {
          max_words: 2,
          instruction_label: "NO MORE THAN TWO WORDS",
          case_sensitive: false,
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Göbekli Tepe is used in the passage to challenge the idea that farming must always come before monumental ritual construction.",
        payload: {},
      },
      {
        id: 5,
        order_index: 5,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "The site disturbs a neat ______ rather than replacing one universal story with another.",
        payload: { max_words: 1, instruction_label: "ONE WORD ONLY" },
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "label", answer_value: "FALSE", explanation: "Sentence two says it does not prove agriculture was irrelevant." },
      { question_id: 2, answer_type: "option_key", answer_value: "A", explanation: "Sentence two supports this interpretation." },
      {
        question_id: 3,
        answer_type: "text",
        answer_value: "subsistence",
        accepted_values: ["subsistence", "belief", "social organization"],
        explanation: "Sentence four lists subsistence, belief, and social organization.",
      },
      { question_id: 4, answer_type: "label", answer_value: "TRUE", explanation: "Sentence one says the site complicates farming-before-ritual models." },
      { question_id: 5, answer_type: "text", answer_value: "sequence", accepted_values: ["sequence"], explanation: "Sentence three uses this exact term." },
    ],
  },
  {
    index: 138,
    type: "mixed",
    title: "Bird Migration and Navigation",
    topic_index: "animal_navigation/bird_migration_navigation",
    passage:
      "Bird migration is sometimes imagined as a simple instinctive route, but navigation often combines inherited tendencies with learning, environmental cues, and physiological timing. Birds may use stars, the Sun, landmarks, smells, or Earth’s magnetic field depending on species and context. This flexibility means migration is not merely a fixed map inside the animal, but a coordination between body, environment, and experience. Its significance lies in showing how complex behaviour can be both biologically prepared and environmentally tuned.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Birds may use stars, the Sun, landmarks, smells, or Earth’s magnetic ______.",
        payload: { max_words: 1, instruction_label: "ONE WORD ONLY" },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says all migrating birds rely on the same navigational cue.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What does the passage suggest by rejecting the idea of migration as “a fixed map inside the animal”?",
        payload: {
          options: [
            { key: "A", text: "Migration is too variable to be explained as a biological behaviour." },
            { key: "B", text: "Migration depends entirely on learning after birth." },
            { key: "C", text: "Migration is a flexible process shaped by inherited tendencies, external cues, and experience." },
            { key: "D", text: "Migration relies mainly on visible landmarks rather than internal biological timing." },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt:
          "What does migration coordinate besides body and environment?",
        payload: { max_words: 1, instruction_label: "ONE WORD ONLY", case_sensitive: false },
      },
      {
        id: 5,
        order_index: 5,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage presents bird migration as a flexible process involving both inherited and environmental factors.",
        payload: {},
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "text", answer_value: "field", accepted_values: ["field"], explanation: "Sentence two mentions Earth’s magnetic field." },
      { question_id: 2, answer_type: "label", answer_value: "FALSE", explanation: "Sentence two says cues vary by species and context." },
      { question_id: 3, answer_type: "option_key", answer_value: "C", explanation: "The passage frames migration as coordinated inheritance, cues, and experience." },
      { question_id: 4, answer_type: "text", answer_value: "experience", accepted_values: ["experience"], explanation: "Sentence three lists body, environment, and experience." },
      { question_id: 5, answer_type: "label", answer_value: "TRUE", explanation: "Sentence one and the final sentence support this." },
    ],
  },
  {
    index: 139,
    type: "mixed",
    title: "The Industrial Clock",
    topic_index: "social_history/industrial_clock",
    passage:
      "Mechanical clocks did more than measure time more precisely; they helped reorganize social life around standardized schedules. In factories, schools, railways, and offices, time became something coordinated across people who did not personally negotiate every task. This did not eliminate older rhythms of season, daylight, or local custom, but it changed which rhythms governed public institutions. The clock’s historical significance lies in turning time into an administrative framework, not simply in improving measurement.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt: "What did clocks turn time into?",
        payload: { max_words: 3, instruction_label: "NO MORE THAN THREE WORDS", case_sensitive: false },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "Mechanical clocks helped organise social life around shared schedules.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt:
          "What broader change does the passage associate with mechanical clocks?",
        payload: {
          options: [
            { key: "A", text: "They made older natural rhythms disappear completely from social life." },
            { key: "B", text: "They allowed institutions to coordinate people through shared schedules." },
            { key: "C", text: "They made public organization less dependent on standardized time." },
            { key: "D", text: "They returned task management to local custom and personal negotiation." },
          ],
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says older rhythms of season and daylight disappeared completely after mechanical clocks spread.",
        payload: {},
      },
      {
        id: 5,
        order_index: 5,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Time became coordinated across people who did not personally ______ every task.",
        payload: { max_words: 1, instruction_label: "ONE WORD ONLY" },
      },
    ],
    answer_key: [
      {
        question_id: 1,
        answer_type: "text",
        answer_value: "an administrative framework",
        accepted_values: ["an administrative framework", "administrative framework"],
        explanation: "The final sentence uses this phrase directly.",
      },
      { question_id: 2, answer_type: "label", answer_value: "TRUE", explanation: "Sentence one explicitly states this reorganization." },
      { question_id: 3, answer_type: "option_key", answer_value: "B", explanation: "Sentence two describes shared schedule coordination across institutions." },
      { question_id: 4, answer_type: "label", answer_value: "FALSE", explanation: "Sentence three says older rhythms were not eliminated entirely." },
      { question_id: 5, answer_type: "text", answer_value: "negotiate", accepted_values: ["negotiate"], explanation: "Sentence two says people did not personally negotiate each task." },
    ],
  },
  {
    index: 140,
    type: "mixed",
    title: "Coral Reefs as Infrastructure",
    topic_index: "marine_ecology/coral_reefs_infrastructure",
    passage:
      "Coral reefs are often valued for biodiversity, but they also function as living infrastructure by reducing wave energy before it reaches shorelines. This protective role depends on reef structure, depth, continuity, and ecological health, so a reef’s value cannot be separated from its condition. When reefs degrade, coastal communities may lose not only species richness but also a form of natural risk reduction. Their significance therefore lies in linking ecological integrity with physical protection.",
    questions: [
      {
        id: 1,
        order_index: 1,
        question_type_index: "mcq",
        question_type_label: "Multiple Choice",
        prompt: "Why does reef condition matter according to the passage?",
        payload: {
          options: [
            { key: "A", text: "Biodiversity alone guarantees the same level of protection in all reefs." },
            { key: "B", text: "Natural risk reduction replaces the need to preserve ecological integrity." },
            { key: "C", text: "Protective value depends on factors such as structure, depth, continuity, and ecological health." },
            { key: "D", text: "Wave energy is reduced independently of reef form or environmental condition." },
          ],
        },
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage says a reef’s protective value is separate from its ecological condition.",
        payload: {},
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "sentence_completion",
        question_type_label: "Sentence Completion",
        prompt:
          "Coral reefs can reduce wave energy before it reaches ______.",
        payload: { max_words: 1, instruction_label: "ONE WORD ONLY" },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "short_answer",
        question_type_label: "Short Answer",
        prompt:
          "What may coastal communities lose besides species richness?",
        payload: { max_words: 4, instruction_label: "NO MORE THAN FOUR WORDS", case_sensitive: false },
      },
      {
        id: 5,
        order_index: 5,
        question_type_index: "tfng",
        question_type_label: "True / False / Not Given",
        prompt:
          "The passage presents coral reefs as valuable for both biodiversity and coastal protection.",
        payload: {},
      },
    ],
    answer_key: [
      { question_id: 1, answer_type: "option_key", answer_value: "C", explanation: "Sentence two lists these exact dependence factors." },
      { question_id: 2, answer_type: "label", answer_value: "FALSE", explanation: "Sentence two says value cannot be separated from condition." },
      { question_id: 3, answer_type: "text", answer_value: "shorelines", accepted_values: ["shorelines"], explanation: "Sentence one uses this exact word." },
      { question_id: 4, answer_type: "text", answer_value: "natural risk reduction", accepted_values: ["natural risk reduction"], explanation: "Sentence three uses this phrase." },
      { question_id: 5, answer_type: "label", answer_value: "TRUE", explanation: "Sentence one and final sentence link biodiversity with protection." },
    ],
  },
];

async function run() {
  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../artifacts/readtok/src/lib/reading-material-db.v2.stitched-8plus.json",
  );

  const normalized = cards.map((card) => {
    const questionSetTypeLabel = SET_LABEL[card.type];
    return {
      id: `ielts_reading_80_${card.type}_${String(card.index).padStart(4, "0")}`,
      schema_version: "2.1",
      exam_index: "ielts_reading",
      exam_label: "IELTS Reading",
      band_index: 80,
      band_label: "8.0+",
      question_set_type_index: card.type,
      question_set_type_label: questionSetTypeLabel,
      topic_index: card.topic_index,
      topic_label: card.title,
      title: card.title,
      language_code: "en",
      status: "active",
      passage: card.passage,
      passage_meta: {
        sentence_count: 4,
        word_count: countWords(card.passage),
      },
      questions: card.questions,
      answer_key: card.answer_key,
    };
  });

  await writeFile(outPath, JSON.stringify(normalized, null, 2), "utf8");
  console.log(`Wrote ${normalized.length} cards to ${outPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
