export type QuestionType = "multiple_choice" | "true_false_not_given" | "matching" | "sentence_completion";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  evidence: string[];
}

export interface ReadingCard {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  band: string;
  passage: string;
  questions: Question[];
}

export const readingMaterialDatabase: ReadingCard[] = [
  {
    id: "environment-climate-change-1",
    title: "Rising Global Temperatures",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Rising global temperatures are causing significant changes in weather patterns worldwide. Extreme heatwaves and intense storms have become more frequent in many regions. Scientists warn that continued greenhouse gas emissions will lead to irreversible damage to ecosystems. Coastal cities face increasing threats from rising sea levels due to melting polar ice. International agreements aim to limit warming to 1.5 degrees Celsius, but progress remains slow.",
    questions: [
      {
        id: "env-1-q1",
        type: "multiple_choice",
        text: "What is one consequence of rising global temperatures?",
        options: ["A) Decreased storm activity", "B) More frequent extreme weather", "C) Lower sea levels", "D) Reduced greenhouse gas emissions"],
        correctAnswer: "B) More frequent extreme weather",
        explanation: "The passage says extreme heatwaves and intense storms have become more frequent in many regions.",
        evidence: ["Extreme heatwaves and intense storms have become more frequent in many regions."]
      },
      {
        id: "env-1-q2",
        type: "true_false_not_given",
        text: "All coastal cities will be underwater by 2050.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "Not Given",
        explanation: "The passage says coastal cities face increasing threats, but it does not say all will be underwater by 2050.",
        evidence: ["Coastal cities face increasing threats from rising sea levels due to melting polar ice."]
      },
      {
        id: "env-1-q3",
        type: "matching",
        text: "Match the sentence endings: i. Scientists warn that continued emissions will... ii. International agreements aim to...",
        options: ["i-B, ii-A", "i-A, ii-C", "i-C, ii-B", "i-B, ii-C"],
        correctAnswer: "i-B, ii-A",
        explanation: "Continued emissions are linked to irreversible ecosystem damage, while agreements aim to limit warming to 1.5°C.",
        evidence: ["Scientists warn that continued greenhouse gas emissions will lead to irreversible damage to ecosystems.", "International agreements aim to limit warming to 1.5 degrees Celsius, but progress remains slow."]
      }
    ]
  },
  {
    id: "environment-climate-change-2",
    title: "Deforestation in the Amazon",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Deforestation in the Amazon rainforest continues at an alarming rate despite global awareness campaigns. This loss of trees reduces the planet’s capacity to absorb carbon dioxide. Indigenous communities are particularly affected as their traditional lands disappear. Governments have introduced new laws to protect remaining forests, yet enforcement is often weak. Sustainable logging practices are being promoted as a possible solution.",
    questions: [
      {
        id: "env-2-q1",
        type: "true_false_not_given",
        text: "Deforestation in the Amazon has completely stopped.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage states that deforestation continues at an alarming rate.",
        evidence: ["Deforestation in the Amazon rainforest continues at an alarming rate despite global awareness campaigns."]
      },
      {
        id: "env-2-q2",
        type: "multiple_choice",
        text: "Why is deforestation in the Amazon harmful?",
        options: ["A) It increases carbon absorption", "B) It reduces the planet’s carbon absorption capacity", "C) It has no effect on indigenous people", "D) It strengthens government enforcement"],
        correctAnswer: "B) It reduces the planet’s carbon absorption capacity",
        explanation: "The loss of trees reduces the planet’s capacity to absorb carbon dioxide.",
        evidence: ["This loss of trees reduces the planet’s capacity to absorb carbon dioxide."]
      },
      {
        id: "env-2-q3",
        type: "sentence_completion",
        text: "Sustainable logging practices are being promoted as a ...",
        correctAnswer: "possible solution",
        explanation: "The final sentence identifies sustainable logging practices as a possible solution.",
        evidence: ["Sustainable logging practices are being promoted as a possible solution."]
      }
    ]
  },
  {
    id: "environment-climate-change-3",
    title: "Plastic Pollution in Oceans",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Plastic pollution in oceans has reached critical levels in recent decades. Marine animals often mistake plastic debris for food, leading to injury or death. Microplastics have now entered the human food chain through seafood consumption. Some countries have banned single-use plastics to reduce ocean waste. However, global cooperation is still required for meaningful change.",
    questions: [
      {
        id: "env-3-q1",
        type: "multiple_choice",
        text: "What do marine animals often mistake plastic for?",
        options: ["A) Natural predators", "B) Food", "C) Shelter", "D) Breeding grounds"],
        correctAnswer: "B) Food",
        explanation: "Marine animals often mistake plastic debris for food.",
        evidence: ["Marine animals often mistake plastic debris for food, leading to injury or death."]
      },
      {
        id: "env-3-q2",
        type: "true_false_not_given",
        text: "Microplastics have not yet affected humans.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says microplastics have entered the human food chain through seafood consumption.",
        evidence: ["Microplastics have now entered the human food chain through seafood consumption."]
      },
      {
        id: "env-3-q3",
        type: "matching",
        text: "Countries have banned single-use plastics to ...",
        options: ["A) increase ocean waste", "B) reduce ocean waste"],
        correctAnswer: "B) reduce ocean waste",
        explanation: "The passage states that some countries banned single-use plastics to reduce ocean waste.",
        evidence: ["Some countries have banned single-use plastics to reduce ocean waste."]
      }
    ]
  },
  {
    id: "environment-climate-change-4",
    title: "Renewable Energy Expansion",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Renewable energy sources are expanding rapidly as countries seek to reduce fossil fuel dependence. Solar and wind power now account for a growing share of electricity generation. Battery storage technology is improving to address the intermittent nature of these sources. Nevertheless, initial investment costs remain high for many developing nations. International funding programs are helping to bridge this financial gap.",
    questions: [
      {
        id: "env-4-q1",
        type: "true_false_not_given",
        text: "Renewable energy has completely replaced fossil fuels.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says renewable energy is expanding to reduce fossil fuel dependence, not that it has completely replaced fossil fuels.",
        evidence: ["Renewable energy sources are expanding rapidly as countries seek to reduce fossil fuel dependence."]
      },
      {
        id: "env-4-q2",
        type: "multiple_choice",
        text: "What challenge do solar and wind power still face?",
        options: ["A) They are always available", "B) Intermittent supply", "C) Low investment costs", "D) No need for storage"],
        correctAnswer: "B) Intermittent supply",
        explanation: "Battery storage is improving to address the intermittent nature of solar and wind power.",
        evidence: ["Battery storage technology is improving to address the intermittent nature of these sources."]
      },
      {
        id: "env-4-q3",
        type: "sentence_completion",
        text: "International funding programs are helping to ...",
        correctAnswer: "bridge this financial gap",
        explanation: "The final sentence states that international funding programs are helping to bridge this financial gap.",
        evidence: ["International funding programs are helping to bridge this financial gap."]
      }
    ]
  },
  {
    id: "environment-climate-change-5",
    title: "Urban Green Spaces",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Urban green spaces provide essential cooling effects in densely populated cities. Trees and parks absorb heat and release moisture into the air. Studies link access to greenery with lower rates of respiratory illnesses. However, many city planners still prioritise commercial buildings over green areas. Community campaigns are increasingly pushing for more parks in urban centres.",
    questions: [
      {
        id: "env-5-q1",
        type: "multiple_choice",
        text: "What benefit do urban green spaces offer according to studies?",
        options: ["A) Higher respiratory illness rates", "B) Lower respiratory illness rates", "C) Increased commercial space", "D) Reduced community campaigns"],
        correctAnswer: "B) Lower respiratory illness rates",
        explanation: "Studies link access to greenery with lower rates of respiratory illnesses.",
        evidence: ["Studies link access to greenery with lower rates of respiratory illnesses."]
      },
      {
        id: "env-5-q2",
        type: "true_false_not_given",
        text: "All city planners now prioritise green spaces.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says many city planners still prioritise commercial buildings over green areas.",
        evidence: ["However, many city planners still prioritise commercial buildings over green areas."]
      },
      {
        id: "env-5-q3",
        type: "matching",
        text: "Match the sentence endings: i. Trees and parks ... ii. Community campaigns ...",
        options: ["i-A, ii-B", "i-B, ii-A", "i-A, ii-A", "i-B, ii-B"],
        correctAnswer: "i-A, ii-B",
        explanation: "Trees and parks absorb heat and release moisture; community campaigns are pushing for more parks.",
        evidence: ["Trees and parks absorb heat and release moisture into the air.", "Community campaigns are increasingly pushing for more parks in urban centres."]
      }
    ]
  },
  {
    id: "environment-climate-change-6",
    title: "Coral Reefs and Acidification",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Coral reefs are dying at an unprecedented rate due to ocean acidification. Rising sea temperatures cause coral bleaching, which weakens reef structures. These ecosystems support millions of marine species and coastal economies. Conservationists are experimenting with coral gardening techniques to restore damaged areas. Success depends on immediate reductions in global carbon emissions.",
    questions: [
      {
        id: "env-6-q1",
        type: "true_false_not_given",
        text: "Coral bleaching has no impact on marine species.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says coral bleaching weakens reef structures, and reefs support millions of marine species.",
        evidence: ["Rising sea temperatures cause coral bleaching, which weakens reef structures.", "These ecosystems support millions of marine species and coastal economies."]
      },
      {
        id: "env-6-q2",
        type: "multiple_choice",
        text: "What technique are conservationists using to restore reefs?",
        options: ["A) Coral gardening", "B) Increased fishing", "C) Ocean acidification", "D) Higher temperatures"],
        correctAnswer: "A) Coral gardening",
        explanation: "Conservationists are experimenting with coral gardening techniques to restore damaged areas.",
        evidence: ["Conservationists are experimenting with coral gardening techniques to restore damaged areas."]
      },
      {
        id: "env-6-q3",
        type: "sentence_completion",
        text: "Success depends on immediate reductions in ...",
        correctAnswer: "global carbon emissions",
        explanation: "The final sentence states that success depends on immediate reductions in global carbon emissions.",
        evidence: ["Success depends on immediate reductions in global carbon emissions."]
      }
    ]
  },
  {
    id: "environment-climate-change-7",
    title: "Electric Vehicles",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Electric vehicles are becoming more popular as battery technology improves. They produce zero tailpipe emissions and help combat urban air pollution. Charging infrastructure is still limited in many rural areas. Governments offer subsidies to encourage consumers to switch from petrol cars. Long-term savings on fuel costs make electric vehicles attractive to many buyers.",
    questions: [
      {
        id: "env-7-q1",
        type: "multiple_choice",
        text: "What advantage do electric vehicles have over petrol cars?",
        options: ["A) Higher emissions", "B) Zero tailpipe emissions", "C) Limited battery life", "D) More expensive fuel"],
        correctAnswer: "B) Zero tailpipe emissions",
        explanation: "Electric vehicles produce zero tailpipe emissions.",
        evidence: ["They produce zero tailpipe emissions and help combat urban air pollution."]
      },
      {
        id: "env-7-q2",
        type: "true_false_not_given",
        text: "Charging stations are widespread in all rural areas.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says charging infrastructure is still limited in many rural areas.",
        evidence: ["Charging infrastructure is still limited in many rural areas."]
      },
      {
        id: "env-7-q3",
        type: "matching",
        text: "Governments offer subsidies to ...",
        options: ["A) discourage electric vehicles", "B) encourage consumers to switch"],
        correctAnswer: "B) encourage consumers to switch",
        explanation: "Governments offer subsidies to encourage consumers to switch from petrol cars.",
        evidence: ["Governments offer subsidies to encourage consumers to switch from petrol cars."]
      }
    ]
  },
  {
    id: "environment-climate-change-8",
    title: "Wildfires and Droughts",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Wildfires have increased in frequency and intensity due to prolonged droughts. These fires destroy vast areas of forest and release stored carbon into the atmosphere. Local wildlife populations suffer massive losses during each event. Firefighting agencies are adopting new technologies for early detection. Climate change is widely accepted as the main driver of this trend.",
    questions: [
      {
        id: "env-8-q1",
        type: "true_false_not_given",
        text: "Wildfires are decreasing in frequency.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage states that wildfires have increased in frequency and intensity.",
        evidence: ["Wildfires have increased in frequency and intensity due to prolonged droughts."]
      },
      {
        id: "env-8-q2",
        type: "multiple_choice",
        text: "What is the main driver of increased wildfires?",
        options: ["A) Early detection technology", "B) Climate change", "C) Reduced carbon release", "D) Wildlife protection"],
        correctAnswer: "B) Climate change",
        explanation: "Climate change is widely accepted as the main driver of this trend.",
        evidence: ["Climate change is widely accepted as the main driver of this trend."]
      },
      {
        id: "env-8-q3",
        type: "sentence_completion",
        text: "Firefighting agencies are adopting new technologies for ...",
        correctAnswer: "early detection",
        explanation: "The passage says firefighting agencies are adopting new technologies for early detection.",
        evidence: ["Firefighting agencies are adopting new technologies for early detection."]
      }
    ]
  },
  {
    id: "environment-climate-change-9",
    title: "Waste Recycling Rates",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Waste recycling rates vary greatly between developed and developing countries. Many nations struggle with contamination of recyclable materials. Public education campaigns have proven effective in improving sorting habits. Advanced sorting machines are now being installed in large recycling plants. Global trade in recycled materials faces new restrictions in some regions.",
    questions: [
      {
        id: "env-9-q1",
        type: "multiple_choice",
        text: "What has proven effective in improving recycling?",
        options: ["A) Contamination of materials", "B) Public education campaigns", "C) Trade restrictions", "D) Reduced sorting habits"],
        correctAnswer: "B) Public education campaigns",
        explanation: "Public education campaigns have proven effective in improving sorting habits.",
        evidence: ["Public education campaigns have proven effective in improving sorting habits."]
      },
      {
        id: "env-9-q2",
        type: "true_false_not_given",
        text: "All countries have high recycling rates.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says recycling rates vary greatly between developed and developing countries.",
        evidence: ["Waste recycling rates vary greatly between developed and developing countries."]
      },
      {
        id: "env-9-q3",
        type: "matching",
        text: "Match the sentence endings: i. Advanced sorting machines ... ii. Global trade ...",
        options: ["i-A, ii-B", "i-B, ii-A", "i-A, ii-A", "i-B, ii-B"],
        correctAnswer: "i-A, ii-B",
        explanation: "Advanced sorting machines are being installed in plants, while global trade faces new restrictions.",
        evidence: ["Advanced sorting machines are now being installed in large recycling plants.", "Global trade in recycled materials faces new restrictions in some regions."]
      }
    ]
  },
  {
    id: "environment-climate-change-10",
    title: "Biodiversity Loss",
    difficulty: "Hard",
    topic: "Environment and Climate Change",
    band: "7.0–7.5",
    passage: "Biodiversity loss threatens the stability of entire ecosystems worldwide. Species extinction rates are currently higher than at any time in human history. Protected areas play a crucial role in preserving endangered animals. However, illegal poaching continues to undermine conservation efforts. International treaties aim to strengthen protection for vulnerable species.",
    questions: [
      {
        id: "env-10-q1",
        type: "true_false_not_given",
        text: "Biodiversity loss has slowed in recent years.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says species extinction rates are currently higher than at any time in human history.",
        evidence: ["Species extinction rates are currently higher than at any time in human history."]
      },
      {
        id: "env-10-q2",
        type: "multiple_choice",
        text: "What undermines conservation efforts?",
        options: ["A) Protected areas", "B) Illegal poaching", "C) International treaties", "D) Species preservation"],
        correctAnswer: "B) Illegal poaching",
        explanation: "The passage states that illegal poaching continues to undermine conservation efforts.",
        evidence: ["However, illegal poaching continues to undermine conservation efforts."]
      },
      {
        id: "env-10-q3",
        type: "sentence_completion",
        text: "Protected areas play a crucial role in ...",
        correctAnswer: "preserving endangered animals",
        explanation: "The passage says protected areas play a crucial role in preserving endangered animals.",
        evidence: ["Protected areas play a crucial role in preserving endangered animals."]
      }
    ]
  },
  {
    id: "education-learning-1",
    title: "Online Learning Platforms",
    difficulty: "Hard",
    topic: "Education and Learning",
    band: "7.0–7.5",
    passage: "Online learning platforms have revolutionised access to higher education globally. Students in remote areas can now attend lectures from prestigious universities. Interactive tools and recorded sessions allow flexible study schedules. However, many learners report feeling isolated without face-to-face interaction. Universities are developing hybrid models to combine both approaches.",
    questions: [
      {
        id: "edu-1-q1",
        type: "multiple_choice",
        text: "What advantage does online learning offer remote students?",
        options: ["A) Mandatory relocation", "B) Access to prestigious universities", "C) Less flexible schedules", "D) No recorded sessions"],
        correctAnswer: "B) Access to prestigious universities",
        explanation: "Remote students can now attend lectures from prestigious universities.",
        evidence: ["Students in remote areas can now attend lectures from prestigious universities."]
      },
      {
        id: "edu-1-q2",
        type: "true_false_not_given",
        text: "All students prefer online learning over traditional classes.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "Not Given",
        explanation: "The passage says many learners feel isolated, but it does not state what all students prefer.",
        evidence: ["However, many learners report feeling isolated without face-to-face interaction."]
      },
      {
        id: "edu-1-q3",
        type: "matching",
        text: "Match the sentence endings: i. Interactive tools allow ... ii. Many learners report ...",
        options: ["i-A, ii-B", "i-B, ii-A", "i-A, ii-A", "i-B, ii-B"],
        correctAnswer: "i-A, ii-B",
        explanation: "Interactive tools allow flexible schedules, while many learners report feeling isolated.",
        evidence: ["Interactive tools and recorded sessions allow flexible study schedules.", "However, many learners report feeling isolated without face-to-face interaction."]
      }
    ]
  }
];

export const readingCards = readingMaterialDatabase;

export function getRandomReadingCards(count: number): ReadingCard[] {
  if (readingMaterialDatabase.length === 0) {
    return [];
  }

  const shuffled = [...readingMaterialDatabase];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (count <= shuffled.length) {
    return shuffled.slice(0, count);
  }

  return Array.from({ length: count }, (_, index) => shuffled[index % shuffled.length]);
}
