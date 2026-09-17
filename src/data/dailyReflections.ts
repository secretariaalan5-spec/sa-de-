export interface DailyReflection {
  quote: string;
  author: string;
  role?: string;
}

export const dailyReflections: DailyReflection[] = [
  {
    quote: "A enfermagem é uma arte; e para realizá-la como arte, requer uma devoção tão exclusiva, um preparo tão rigoroso, quanto a obra de qualquer pintor ou escultor.",
    author: "Florence Nightingale",
    role: "Pioneira da Enfermagem Moderna"
  },
  {
    quote: "Não esmorecer para não desmerecer. O trabalho em prol da saúde pública é uma missão diária pela vida.",
    author: "Oswaldo Cruz",
    role: "Médico Sanitarista e Cientista Brasileiro"
  },
  {
    quote: "O trabalho social precisa de mobilização das forças. Cada um é o elo de uma cadeia que transforma a comunidade.",
    author: "Dra. Zilda Arns",
    role: "Médica Pediatra e Sanitarista Brasileira"
  },
  {
    quote: "Cura quando possível, alivia quando necessário, mas conforta sempre.",
    author: "Hipócrates",
    role: "Pai da Medicina"
  },
  {
    quote: "O SUS é a maior política de inclusão social deste país: cuidar da saúde é cuidar da dignidade do povo.",
    author: "Sérgio Arouca",
    role: "Sanitarista e um dos Criadores do SUS"
  },
  {
    quote: "É preciso cuidar de quem cuida. O acolhimento começa na escuta e no respeito pelo próximo.",
    author: "Nise da Silveira",
    role: "Psiquiatra Humanista Brasileira"
  },
  {
    quote: "Cuidar é mais que um ato; é uma atitude. Abrange mais que um momento de atenção: representa dedicação e desvelo.",
    author: "Leonardo Boff",
    role: "Filósofo e Escritor"
  },
  {
    quote: "O primeiro passo para o cuidado é a presença. Estar verdadeiramente presente faz toda a diferença na vida de um paciente.",
    author: "Dra. Ana Claudia Quintana Arantes",
    role: "Médica e Escritora Brasileira"
  },
  {
    quote: "Quando você cuida de um paciente, você pode vencer ou perder. Quando você cuida de uma pessoa, você sempre vence.",
    author: "Dr. Patch Adams",
    role: "Médico e Ativista Humanitário"
  },
  {
    quote: "A dedicação dos agentes de saúde e da enfermagem constrói a verdadeira ponte entre a medicina e as famílias.",
    author: "Carlos Chagas",
    role: "Médico e Pesquisador Brasileiro"
  },
  {
    quote: "O exemplo não é a melhor forma de influenciar os outros, é a única.",
    author: "Albert Schweitzer",
    role: "Médico Humanitário e Nobel da Paz"
  },
  {
    quote: "A escuta atenta é a forma mais profunda de generosidade que podemos oferecer a alguém em sofrimento.",
    author: "Simone Weil",
    role: "Filósofa"
  },
  {
    quote: "Atenção primária é olhar nos olhos, conhecer a realidade e levar esperança para dentro dos lares.",
    author: "Saúde Coletiva",
    role: "Reflexão sobre a Atenção Básica"
  },
  {
    quote: "Pessoas que dedicam seu tempo a cuidar de outras pessoas são a verdadeira força que move uma sociedade justa.",
    author: "Nelson Mandela",
    role: "Líder Humanitário"
  },
  {
    quote: "A empatia é ver com os olhos de outro, ouvir com os ouvidos de outro e sentir com o coração de outro.",
    author: "Alfred Adler",
    role: "Psicólogo e Médico"
  },
  {
    quote: "Trabalhar em equipe na saúde é somar saberes e multiplicar cuidados para salvar vidas.",
    author: "Adolfo Lutz",
    role: "Pioneiro da Saúde Pública no Brasil"
  },
  {
    quote: "O valor da vida humana não se mede pelo que ela produz, mas pelo amor e cuidado que recebe.",
    author: "Madre Teresa de Calcutá",
    role: "Humanitária e Nobel da Paz"
  },
  {
    quote: "Cuidar de uma comunidade é plantar sementes de saúde e dignidade que florescem por gerações.",
    author: "Paulo Freire",
    role: "Educador e Humanista"
  },
  {
    quote: "A gentileza na rotina de trabalho é o melhor remédio para aliviar a tensão dos dias difíceis.",
    author: "Rubem Alves",
    role: "Escritor e Educador"
  },
  {
    quote: "A grandeza de uma profissão está em servir com zelo, competência e afeto.",
    author: "Ana Néri",
    role: "Pioneira da Enfermagem no Brasil"
  },
  {
    quote: "Cada visita domiciliar é uma oportunidade de transformar solidão em acolhimento e cuidado.",
    author: "Vozes da Atenção Básica",
    role: "Valorização do Agente de Saúde"
  },
  {
    quote: "Nenhum de nós é tão forte quanto todos nós juntos. Na saúde, a união da equipe salva vidas.",
    author: "Provérbio",
    role: "Trabalho em Equipe"
  },
  {
    quote: "A saúde não é apenas a ausência de doença, mas o bem-estar físico, mental e social de toda a comunidade.",
    author: "OMS",
    role: "Organização Mundial da Saúde"
  },
  {
    quote: "Que o nosso trabalho de hoje leve alívio, esperança e cuidado a quem mais necessita.",
    author: "Saúde+",
    role: "Mensagem do Dia"
  }
];

export function getDailyReflection(date: Date = new Date()): DailyReflection {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const index = Math.abs(dayOfYear) % dailyReflections.length;
  return dailyReflections[index];
}
