export type QuestionType = "multiple_choice" | "true_false_not_given" | "matching";

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
  passage: string;
  questions: Question[];
}

export const readingCards: ReadingCard[] = [
  {
    id: "card-1",
    title: "Urban Greenery",
    difficulty: "Medium",
    passage: "Urban green spaces play a vital role in improving city life. Trees and parks help reduce air pollution by absorbing carbon dioxide and releasing oxygen. They also lower temperatures during heatwaves through shade and evapotranspiration. Moreover, access to greenery has been linked to better mental health and reduced stress levels among residents. However, many rapidly growing cities still prioritize concrete development over planting new parks.",
    questions: [
      {
        id: "q1-1",
        type: "multiple_choice",
        text: "What is one benefit of urban trees mentioned?",
        options: ["A) They increase traffic speed", "B) They absorb carbon dioxide", "C) They raise city temperatures", "D) They reduce the need for buildings"],
        correctAnswer: "B) They absorb carbon dioxide",
        explanation: "The passage explicitly states that trees help reduce air pollution by absorbing carbon dioxide.",
        evidence: ["Trees and parks help reduce air pollution by absorbing carbon dioxide and releasing oxygen."]
      },
      {
        id: "q1-2",
        type: "true_false_not_given",
        text: "Residents in cities with many parks always report perfect mental health.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "Not Given",
        explanation: "The passage says it is 'linked to better mental health', not 'perfect mental health'.",
        evidence: ["Moreover, access to greenery has been linked to better mental health and reduced stress levels among residents."]
      },
      {
        id: "q1-3",
        type: "matching",
        text: "Match: i. Urban green spaces",
        options: ["A) still focus mainly on construction", "B) help combat rising temperatures"],
        correctAnswer: "B) help combat rising temperatures",
        explanation: "Urban green spaces lower temperatures during heatwaves.",
        evidence: ["They also lower temperatures during heatwaves through shade and evapotranspiration."]
      }
    ]
  },
  {
    id: "card-2",
    title: "Renewable Energy",
    difficulty: "Easy",
    passage: "The global shift towards renewable energy sources has accelerated in recent years. Solar and wind power have become significantly cheaper, making them competitive with fossil fuels. Governments worldwide are investing heavily in green infrastructure to meet climate targets. Despite this progress, fossil fuels still account for the majority of global energy consumption. The transition requires not only new technology but also changes in policy and consumer behavior.",
    questions: [
      {
        id: "q2-1",
        type: "multiple_choice",
        text: "Why has renewable energy become more competitive?",
        options: ["A) Fossil fuels are banned", "B) Solar and wind costs have dropped", "C) People stopped using electricity", "D) Governments shut down power plants"],
        correctAnswer: "B) Solar and wind costs have dropped",
        explanation: "The text notes that solar and wind power have become significantly cheaper.",
        evidence: ["Solar and wind power have become significantly cheaper, making them competitive with fossil fuels."]
      },
      {
        id: "q2-2",
        type: "true_false_not_given",
        text: "Fossil fuels currently provide most of the world's energy.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "True",
        explanation: "The passage confirms fossil fuels still account for the majority of global energy consumption.",
        evidence: ["Despite this progress, fossil fuels still account for the majority of global energy consumption."]
      },
      {
        id: "q2-3",
        type: "matching",
        text: "Match: i. Governments",
        options: ["A) are investing in green infrastructure", "B) still dominate global energy supply"],
        correctAnswer: "A) are investing in green infrastructure",
        explanation: "Governments worldwide are investing heavily in green infrastructure.",
        evidence: ["Governments worldwide are investing heavily in green infrastructure to meet climate targets."]
      }
    ]
  },
  {
    id: "card-3",
    title: "Sleep and Productivity",
    difficulty: "Medium",
    passage: "Adequate sleep is essential for maintaining high levels of productivity. Research shows that individuals who sleep fewer than six hours per night experience significant cognitive decline. Memory consolidation, a key function of sleep, directly affects learning and decision-making. Many companies have started to recognise the importance of employee well-being, including sleep. Flexible working hours and nap rooms are becoming more common in progressive workplaces.",
    questions: [
      {
        id: "q3-1",
        type: "multiple_choice",
        text: "What happens when people sleep fewer than six hours?",
        options: ["A) They become more productive", "B) They experience cognitive decline", "C) They develop stronger memory", "D) They need less food"],
        correctAnswer: "B) They experience cognitive decline",
        explanation: "Individuals sleeping less than six hours experience significant cognitive decline.",
        evidence: ["Research shows that individuals who sleep fewer than six hours per night experience significant cognitive decline."]
      },
      {
        id: "q3-2",
        type: "true_false_not_given",
        text: "All major companies now offer nap rooms for employees.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "Not Given",
        explanation: "The passage says 'many companies' and 'becoming more common', but does not mention 'all major companies'.",
        evidence: ["Many companies have started to recognise the importance of employee well-being, including sleep.", "Flexible working hours and nap rooms are becoming more common in progressive workplaces."]
      },
      {
        id: "q3-3",
        type: "matching",
        text: "Match: i. Memory consolidation",
        options: ["A) offer flexible hours and nap rooms", "B) affects learning and decision-making"],
        correctAnswer: "B) affects learning and decision-making",
        explanation: "Memory consolidation directly affects learning and decision-making.",
        evidence: ["Memory consolidation, a key function of sleep, directly affects learning and decision-making."]
      }
    ]
  },
  {
    id: "card-4",
    title: "Plastic Pollution",
    difficulty: "Hard",
    passage: "Plastic pollution has become one of the most pressing environmental issues of our time. Every year, millions of tonnes of plastic waste enter the world's oceans, harming marine life. Microplastics have been found in drinking water, food, and even human blood. While recycling efforts have increased, only a small fraction of plastic is actually recycled. Reducing single-use plastics and developing biodegradable alternatives are seen as key solutions.",
    questions: [
      {
        id: "q4-1",
        type: "multiple_choice",
        text: "Where have microplastics been found?",
        options: ["A) Only in oceans", "B) In drinking water, food, and human blood", "C) In outer space", "D) Only in factories"],
        correctAnswer: "B) In drinking water, food, and human blood",
        explanation: "The text explicitly lists drinking water, food, and human blood.",
        evidence: ["Microplastics have been found in drinking water, food, and even human blood."]
      },
      {
        id: "q4-2",
        type: "true_false_not_given",
        text: "Most plastic waste is successfully recycled worldwide.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage states that only a small fraction of plastic is actually recycled.",
        evidence: ["While recycling efforts have increased, only a small fraction of plastic is actually recycled."]
      },
      {
        id: "q4-3",
        type: "matching",
        text: "Match: i. Microplastics",
        options: ["A) are considered a key solution", "B) have been detected in human blood"],
        correctAnswer: "B) have been detected in human blood",
        explanation: "Microplastics have been found in drinking water, food, and human blood.",
        evidence: ["Microplastics have been found in drinking water, food, and even human blood."]
      }
    ]
  },
  {
    id: "card-5",
    title: "Online Education",
    difficulty: "Medium",
    passage: "Online education has transformed the way people access knowledge. With the rise of digital platforms, students can learn from anywhere in the world at their own pace. This flexibility has been especially beneficial for working professionals seeking to upskill. However, online learning also presents challenges such as lack of social interaction and difficulty maintaining motivation. Blended learning models that combine online and in-person elements are increasingly popular.",
    questions: [
      {
        id: "q5-1",
        type: "multiple_choice",
        text: "Who especially benefits from online learning flexibility?",
        options: ["A) Kindergarten students", "B) Working professionals", "C) Retired athletes", "D) Hospital patients"],
        correctAnswer: "B) Working professionals",
        explanation: "The text mentions flexibility is especially beneficial for working professionals.",
        evidence: ["This flexibility has been especially beneficial for working professionals seeking to upskill."]
      },
      {
        id: "q5-2",
        type: "true_false_not_given",
        text: "Online education has completely replaced traditional classroom learning.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "Not Given",
        explanation: "The passage doesn't mention online education completely replacing traditional classrooms.",
        evidence: ["Blended learning models that combine online and in-person elements are increasingly popular."]
      },
      {
        id: "q5-3",
        type: "matching",
        text: "Match: i. Online education",
        options: ["A) combines online and face-to-face elements", "B) allows learning from anywhere"],
        correctAnswer: "B) allows learning from anywhere",
        explanation: "Students can learn from anywhere in the world.",
        evidence: ["With the rise of digital platforms, students can learn from anywhere in the world at their own pace."]
      }
    ]
  },
  {
    id: "card-6",
    title: "Exercise and Brain Health",
    difficulty: "Medium",
    passage: "Regular physical exercise has been shown to have significant benefits for brain health. Aerobic activities such as running and swimming increase blood flow to the brain, which promotes the growth of new neurons. Exercise also boosts the production of neurotransmitters like serotonin and dopamine, improving mood and reducing anxiety. Studies suggest that physically active individuals have a lower risk of developing neurodegenerative diseases. Even moderate exercise, such as brisk walking, can improve cognitive function over time.",
    questions: [
      {
        id: "q6-1",
        type: "multiple_choice",
        text: "Which neurotransmitter is boosted by exercise?",
        options: ["A) Insulin", "B) Serotonin", "C) Adrenaline", "D) Melatonin"],
        correctAnswer: "B) Serotonin",
        explanation: "Exercise boosts neurotransmitters like serotonin and dopamine.",
        evidence: ["Exercise also boosts the production of neurotransmitters like serotonin and dopamine, improving mood and reducing anxiety."]
      },
      {
        id: "q6-2",
        type: "true_false_not_given",
        text: "Only intense exercise has cognitive benefits.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The text states that 'Even moderate exercise, such as brisk walking, can improve cognitive function'.",
        evidence: ["Even moderate exercise, such as brisk walking, can improve cognitive function over time."]
      },
      {
        id: "q6-3",
        type: "matching",
        text: "Match: i. Aerobic exercise",
        options: ["A) have a lower risk of brain diseases", "B) increases blood flow to the brain"],
        correctAnswer: "B) increases blood flow to the brain",
        explanation: "Aerobic activities increase blood flow to the brain.",
        evidence: ["Aerobic activities such as running and swimming increase blood flow to the brain, which promotes the growth of new neurons."]
      }
    ]
  },
  {
    id: "card-7",
    title: "Artificial Intelligence in Healthcare",
    difficulty: "Hard",
    passage: "Artificial intelligence is revolutionizing the healthcare industry. AI-powered tools can analyze medical images with high accuracy, often detecting diseases earlier than human doctors. Machine learning algorithms are being used to predict patient outcomes and personalize treatment plans. However, concerns about data privacy and the ethical use of AI in medicine remain significant. The integration of AI into healthcare requires careful regulation and transparent decision-making processes.",
    questions: [
      {
        id: "q7-1",
        type: "multiple_choice",
        text: "What can AI tools do in healthcare?",
        options: ["A) Replace all doctors", "B) Analyze medical images accurately", "C) Eliminate all diseases", "D) Reduce hospital costs to zero"],
        correctAnswer: "B) Analyze medical images accurately",
        explanation: "AI-powered tools can analyze medical images with high accuracy.",
        evidence: ["AI-powered tools can analyze medical images with high accuracy, often detecting diseases earlier than human doctors."]
      },
      {
        id: "q7-2",
        type: "true_false_not_given",
        text: "There are no concerns about using AI in healthcare.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage mentions 'concerns about data privacy and the ethical use of AI'.",
        evidence: ["However, concerns about data privacy and the ethical use of AI in medicine remain significant."]
      },
      {
        id: "q7-3",
        type: "matching",
        text: "Match: i. Machine learning",
        options: ["A) requires careful regulation", "B) predicts patient outcomes"],
        correctAnswer: "B) predicts patient outcomes",
        explanation: "Algorithms are being used to predict patient outcomes.",
        evidence: ["Machine learning algorithms are being used to predict patient outcomes and personalize treatment plans."]
      }
    ]
  },
  {
    id: "card-8",
    title: "The Benefits of Reading Fiction",
    difficulty: "Easy",
    passage: "Reading fiction offers more than just entertainment — it enhances empathy and emotional intelligence. Studies show that readers of literary fiction are better at understanding others' emotions and perspectives. Fiction also stimulates the imagination and improves vocabulary and language skills. Regular reading has been associated with reduced stress and improved mental well-being. Despite these benefits, the habit of reading fiction is declining in many countries due to digital distractions.",
    questions: [
      {
        id: "q8-1",
        type: "multiple_choice",
        text: "What does reading fiction improve?",
        options: ["A) Physical strength", "B) Empathy and emotional intelligence", "C) Mathematical skills", "D) Cooking ability"],
        correctAnswer: "B) Empathy and emotional intelligence",
        explanation: "Reading fiction enhances empathy and emotional intelligence.",
        evidence: ["Reading fiction offers more than just entertainment — it enhances empathy and emotional intelligence."]
      },
      {
        id: "q8-2",
        type: "true_false_not_given",
        text: "Reading fiction is becoming more popular worldwide.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage says the habit of reading fiction is 'declining in many countries'.",
        evidence: ["Despite these benefits, the habit of reading fiction is declining in many countries due to digital distractions."]
      },
      {
        id: "q8-3",
        type: "matching",
        text: "Match: i. Literary fiction",
        options: ["A) contribute to declining reading habits", "B) helps understand others' emotions"],
        correctAnswer: "B) helps understand others' emotions",
        explanation: "Readers of literary fiction are better at understanding others' emotions.",
        evidence: ["Studies show that readers of literary fiction are better at understanding others' emotions and perspectives."]
      }
    ]
  },
  {
    id: "card-9",
    title: "Sustainable Agriculture",
    difficulty: "Medium",
    passage: "Sustainable agriculture aims to meet society's food needs without compromising the ability of future generations to do the same. Techniques such as crop rotation, organic farming, and precision agriculture help reduce environmental impact. These methods can improve soil health and decrease reliance on chemical pesticides. However, the transition from conventional to sustainable farming requires significant investment and education. Supporting local food systems and reducing food waste are also critical components of a sustainable food future.",
    questions: [
      {
        id: "q9-1",
        type: "multiple_choice",
        text: "What is a goal of sustainable agriculture?",
        options: ["A) Increasing pesticide use", "B) Meeting food needs without harming the future", "C) Reducing crop variety", "D) Eliminating all farming technology"],
        correctAnswer: "B) Meeting food needs without harming the future",
        explanation: "It aims to meet food needs without compromising future generations.",
        evidence: ["Sustainable agriculture aims to meet society's food needs without compromising the ability of future generations to do the same."]
      },
      {
        id: "q9-2",
        type: "true_false_not_given",
        text: "Switching to sustainable farming is easy and cheap.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The transition requires 'significant investment and education'.",
        evidence: ["However, the transition from conventional to sustainable farming requires significant investment and education."]
      },
      {
        id: "q9-3",
        type: "matching",
        text: "Match: i. Crop rotation",
        options: ["A) support a sustainable food future", "B) helps reduce environmental impact"],
        correctAnswer: "B) helps reduce environmental impact",
        explanation: "Techniques like crop rotation help reduce environmental impact.",
        evidence: ["Techniques such as crop rotation, organic farming, and precision agriculture help reduce environmental impact."]
      }
    ]
  },
  {
    id: "card-10",
    title: "Space Tourism",
    difficulty: "Medium",
    passage: "Space tourism is no longer a distant dream — it has become a reality for a select few. Companies like SpaceX and Blue Origin have successfully launched civilians into space, sparking public interest in commercial space travel. While the experience is currently limited to the ultra-wealthy, experts predict that costs will decrease over time. Space tourism raises questions about its environmental impact, particularly the carbon emissions produced by rocket launches. Balancing innovation with sustainability will be a key challenge for the industry.",
    questions: [
      {
        id: "q10-1",
        type: "multiple_choice",
        text: "Who has primarily accessed space tourism so far?",
        options: ["A) School students", "B) Government officials", "C) Ultra-wealthy individuals", "D) Professional astronauts"],
        correctAnswer: "C) Ultra-wealthy individuals",
        explanation: "The experience is currently limited to the ultra-wealthy.",
        evidence: ["While the experience is currently limited to the ultra-wealthy, experts predict that costs will decrease over time."]
      },
      {
        id: "q10-2",
        type: "true_false_not_given",
        text: "Rocket launches produce zero carbon emissions.",
        options: ["True", "False", "Not Given"],
        correctAnswer: "False",
        explanation: "The passage explicitly mentions 'carbon emissions produced by rocket launches'.",
        evidence: ["Space tourism raises questions about its environmental impact, particularly the carbon emissions produced by rocket launches."]
      },
      {
        id: "q10-3",
        type: "matching",
        text: "Match: i. Commercial space travel",
        options: ["A) are expected to decrease", "B) has sparked public interest"],
        correctAnswer: "B) has sparked public interest",
        explanation: "Launching civilians has sparked public interest in commercial space travel.",
        evidence: ["Companies like SpaceX and Blue Origin have successfully launched civilians into space, sparking public interest in commercial space travel."]
      }
    ]
  }
];
