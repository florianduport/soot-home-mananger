import { type AppLanguage } from "@/lib/i18n/language";

type TranslationTarget = {
  en: string;
  es: string;
};

const EXACT_TRANSLATIONS: Record<string, TranslationTarget> = {
  "Soot - Organisation de la maison": {
    en: "Soot - Home Organization",
    es: "Soot - Organizacion del hogar",
  },
  "Gestion des taches et de la maison": {
    en: "Home and task management",
    es: "Gestion del hogar y de tareas",
  },
  "Aujourd'hui": { en: "Today", es: "Hoy" },
  "Taches": { en: "Tasks", es: "Tareas" },
  Calendrier: { en: "Calendar", es: "Calendario" },
  Budgets: { en: "Budgets", es: "Presupuestos" },
  "Listes d'achats": { en: "Shopping lists", es: "Listas de compras" },
  Projets: { en: "Projects", es: "Proyectos" },
  "Equipements": { en: "Equipment", es: "Equipos" },
  Reglages: { en: "Settings", es: "Ajustes" },
  Maison: { en: "Home", es: "Hogar" },
  Ajouter: { en: "Add", es: "Agregar" },
  "Creer une tache": { en: "Create a task", es: "Crear una tarea" },
  "Creer une liste": { en: "Create a list", es: "Crear una lista" },
  "Nouvelle tache": { en: "New task", es: "Nueva tarea" },
  "Nouvelle liste": { en: "New list", es: "Nueva lista" },
  "Liste complete": { en: "Full list", es: "Lista completa" },
  "Focus du jour": { en: "Today's focus", es: "Foco del dia" },
  Routines: { en: "Routines", es: "Rutinas" },
  "A venir (7 jours)": { en: "Coming up (7 days)", es: "Proximos 7 dias" },
  "Toutes les taches": { en: "All tasks", es: "Todas las tareas" },
  "Une maison calme, une action utile a la fois.": {
    en: "A calm home, one useful action at a time.",
    es: "Un hogar tranquilo, una accion util a la vez.",
  },
  "Aucune tache pour le moment. Commence par creer ta premiere tache.": {
    en: "No tasks yet. Start by creating your first task.",
    es: "Aun no hay tareas. Empieza creando tu primera tarea.",
  },
  "Forest Zen Home OS": { en: "Forest Zen Home OS", es: "Forest Zen Home OS" },
  Produit: { en: "Product", es: "Producto" },
  Onboarding: { en: "Onboarding", es: "Onboarding" },
  Roadmap: { en: "Roadmap", es: "Roadmap" },
  Connexion: { en: "Sign in", es: "Iniciar sesion" },
  "Quotidien maison, pas todo-list": {
    en: "Home daily life, not a todo list",
    es: "Vida diaria del hogar, no una lista de tareas",
  },
  "Une maison bien tenue, sans charge mentale.": {
    en: "A well-managed home, without mental load.",
    es: "Un hogar bien organizado, sin carga mental.",
  },
  "Soot orchestre routines, taches, calendrier et achats dans une experience mobile-first chaleureuse. Un abonnement par maison, gere par le proprietaire principal.": {
    en: "Soot orchestrates routines, tasks, calendar and shopping in a warm mobile-first experience. One subscription per home, managed by the primary owner.",
    es: "Soot orquesta rutinas, tareas, calendario y compras en una experiencia mobile-first calida. Una suscripcion por hogar, gestionada por el propietario principal.",
  },
  "Ouvrir Soot": { en: "Open Soot", es: "Abrir Soot" },
  "Historique Soot": { en: "Soot history", es: "Historial de Soot" },
  Soot: { en: "Soot", es: "Soot" },
  "Soot vous aide à organiser la maison, avec un ton chaleureux et concret.": {
    en: "Soot helps you organize your home with a warm, practical tone.",
    es: "Soot te ayuda a organizar tu hogar con un tono calido y concreto.",
  },
  "Commencez une conversation avec Soot.": {
    en: "Start a conversation with Soot.",
    es: "Empieza una conversacion con Soot.",
  },
  "Guide de ton Soot": { en: "Soot tone guide", es: "Guia de tono de Soot" },
  "Style: chaleureux, clair, concret, orienté action.": {
    en: "Style: warm, clear, concrete, action-oriented.",
    es: "Estilo: calido, claro, concreto, orientado a la accion.",
  },
  'Exemples: "Salut Soot, planifie mon ménage" ou "Soot, ajoute une tâche".': {
    en: 'Examples: "Hi Soot, plan my cleaning" or "Soot, add a task".',
    es: 'Ejemplos: "Hola Soot, planifica mi limpieza" o "Soot, agrega una tarea".',
  },
  "Creer mon foyer": { en: "Create my home", es: "Crear mi hogar" },
  "Voir le parcours 5 min": { en: "See the 5-minute flow", es: "Ver el recorrido de 5 min" },
  "Soot Guide": { en: "Soot Guide", es: "Guia Soot" },
  "5 minutes de questions, puis generation immediate: routines, taches realistes, dates utiles et liste de base.": {
    en: "5 minutes of questions, then immediate generation: routines, realistic tasks, useful dates and a starter list.",
    es: "5 minutos de preguntas y luego generacion inmediata: rutinas, tareas realistas, fechas utiles y lista base.",
  },
  "Focus du jour + routines + a venir 7 jours.": {
    en: "Today's focus + routines + next 7 days.",
    es: "Foco del dia + rutinas + proximos 7 dias.",
  },
  "Equipements relies a l'entretien automatique.": {
    en: "Equipment linked to automatic maintenance.",
    es: "Equipos vinculados al mantenimiento automatico.",
  },
  "Ajouter en un geste (tache / rendez-vous / depense / achat).": {
    en: "Add in one tap (task / appointment / expense / item).",
    es: "Agregar en un gesto (tarea / cita / gasto / compra).",
  },
  "Routines humaines": { en: "Human routines", es: "Rutinas humanas" },
  "Maison vivante": { en: "Living home", es: "Hogar vivo" },
  "Actions choregraphiees": { en: "Choreographed actions", es: "Acciones coreografiadas" },
  "Matin, soir, hebdo: des sequences foyer claires plutot qu'une pile de taches.": {
    en: "Morning, evening, weekly: clear household sequences instead of a pile of tasks.",
    es: "Manana, tarde y semanal: secuencias claras del hogar en lugar de una pila de tareas.",
  },
  "Equipements, saisons, zones et moments de vie pilotent les actions utiles.": {
    en: "Equipment, seasons, zones and life moments drive useful actions.",
    es: "Equipos, estaciones, zonas y momentos de vida guian las acciones utiles.",
  },
  "Un seul bouton Ajouter, une sheet claire, des flux one-thumb sur mobile.": {
    en: "One Add button, one clear sheet, one-thumb mobile flows.",
    es: "Un solo boton Agregar, una hoja clara y flujos de un pulgar en movil.",
  },
  "Onboarding Soot Guide (5 min)": {
    en: "Soot Guide onboarding (5 min)",
    es: "Onboarding de Soot Guide (5 min)",
  },
  "Resultat auto des la fin:": {
    en: "Automatic result right away:",
    es: "Resultado automatico al terminar:",
  },
  "15 taches recurrentes, 3 routines, calendrier dates utiles, 1 liste d'achats de base.": {
    en: "15 recurring tasks, 3 routines, useful-date calendar, 1 starter shopping list.",
    es: "15 tareas recurrentes, 3 rutinas, calendario de fechas utiles y 1 lista base de compras.",
  },
  'Vue "Aujourd\'hui" signature': {
    en: 'Signature "Today" view',
    es: 'Vista "Hoy" distintiva',
  },
  "3 actions maxi, claires et priorisees.": {
    en: "3 max actions, clear and prioritized.",
    es: "Maximo 3 acciones, claras y priorizadas.",
  },
  "Matin / soir / hebdo visibles au meme endroit.": {
    en: "Morning / evening / weekly visible in one place.",
    es: "Manana / tarde / semanal visibles en un solo lugar.",
  },
  "Echeances pretes pour la semaine.": {
    en: "Deadlines ready for the week.",
    es: "Plazos listos para la semana.",
  },
  "Un bouton \"Ajouter\" central ouvre une sheet multi-choix, optimisee one-thumb.": {
    en: "A central Add button opens a multi-choice sheet, optimized for one-thumb use.",
    es: "Un boton central Agregar abre una hoja multiopcion, optimizada para un pulgar.",
  },
  "Pret a passer en mode foyer organise ?": {
    en: "Ready to switch to organized-home mode?",
    es: "Listo para pasar al modo hogar organizado?",
  },
  "Commence gratuitement, configure ton foyer en quelques minutes et laisse Soot faire le gros du cadrage quotidien.": {
    en: "Start for free, set up your home in minutes and let Soot handle the daily structure.",
    es: "Empieza gratis, configura tu hogar en minutos y deja que Soot haga gran parte de la organizacion diaria.",
  },
  "Demarrer avec Soot": { en: "Start with Soot", es: "Empezar con Soot" },
  "Explorer le produit": { en: "Explore the product", es: "Explorar el producto" },
  "Theme global": { en: "Global theme", es: "Tema global" },
  "Ce choix est applique a toute l'application pour cette maison.": {
    en: "This choice is applied to the whole app for this home.",
    es: "Esta opcion se aplica a toda la app de este hogar.",
  },
  "Choisir un theme": { en: "Choose a theme", es: "Elegir un tema" },
  "Fond de l'application": { en: "App background", es: "Fondo de la aplicacion" },
  "Choisir une photo": { en: "Choose a photo", es: "Elegir una foto" },
  "Supprimer le fond": { en: "Remove background", es: "Quitar fondo" },
  "Le theme reprend automatiquement sa couleur de fond.": {
    en: "The theme automatically falls back to its default background color.",
    es: "El tema vuelve automaticamente a su color de fondo.",
  },
  "Langue de l'application": { en: "App language", es: "Idioma de la aplicacion" },
  "Choisis la langue affichee sur la landing et dans l'application.": {
    en: "Choose the language shown on the landing page and in the app.",
    es: "Elige el idioma mostrado en la landing y en la aplicacion.",
  },
  "Detectee automatiquement": { en: "Auto-detected", es: "Detectado automaticamente" },
  Apparence: { en: "Appearance", es: "Apariencia" },
  Membres: { en: "Members", es: "Miembros" },
  Invitations: { en: "Invitations", es: "Invitaciones" },
  Zones: { en: "Zones", es: "Zonas" },
  Categories: { en: "Categories", es: "Categorias" },
  Animaux: { en: "Pets", es: "Mascotas" },
  Personnes: { en: "People", es: "Personas" },
  "Dates importantes": { en: "Important dates", es: "Fechas importantes" },
  Profil: { en: "Profile", es: "Perfil" },
  "Mode Ghibli": { en: "Ghibli mode", es: "Modo Ghibli" },
  Clair: { en: "Light", es: "Claro" },
  Sombre: { en: "Dark", es: "Oscuro" },
  "Se deconnecter": { en: "Sign out", es: "Cerrar sesion" },
  "Actions utilisateur": { en: "User actions", es: "Acciones de usuario" },
  "Le module budget n'est pas encore disponible: lance `npm run db:push` puis recharge la page.": {
    en: "The budget module is not available yet: run `npm run db:push` then refresh the page.",
    es: "El modulo de presupuesto aun no esta disponible: ejecuta `npm run db:push` y recarga la pagina.",
  },
  "Aucune invitation pour le moment.": {
    en: "No invitations yet.",
    es: "Aun no hay invitaciones.",
  },
  "Lien d'invitation": { en: "Invitation link", es: "Enlace de invitacion" },
  "Envoyer l'invitation": { en: "Send invitation", es: "Enviar invitacion" },
  "Le lien d'invitation est affiche ci-dessous.": {
    en: "The invitation link is shown below.",
    es: "El enlace de invitacion se muestra abajo.",
  },
  "Aucune entree pour le moment.": {
    en: "No entries yet.",
    es: "Aun no hay entradas.",
  },
  "Nouvelle entree": { en: "New entry", es: "Nueva entrada" },
  "Aucune date importante enregistree pour le moment.": {
    en: "No important dates saved yet.",
    es: "Aun no hay fechas importantes registradas.",
  },
  "Nouvelle date importante": {
    en: "New important date",
    es: "Nueva fecha importante",
  },
  "Description (optionnel)": {
    en: "Description (optional)",
    es: "Descripcion (opcional)",
  },
  Anniversaire: { en: "Birthday", es: "Cumpleanos" },
  Commemoration: { en: "Anniversary", es: "Conmemoracion" },
  Evenement: { en: "Event", es: "Evento" },
  Autre: { en: "Other", es: "Otro" },
  "Repeter chaque annee": { en: "Repeat every year", es: "Repetir cada ano" },
  "Date unique": { en: "One-time date", es: "Fecha unica" },
  Documents: { en: "Documents", es: "Documentos" },
  Document: { en: "Document", es: "Documento" },
  "Documents lies": { en: "Linked documents", es: "Documentos vinculados" },
  "Documents:": { en: "Documents:", es: "Documentos:" },
  "Taches liees:": { en: "Linked tasks:", es: "Tareas vinculadas:" },
  "Garanties & recus": {
    en: "Warranties & receipts",
    es: "Garantias y recibos",
  },
  "Ajouter un document": {
    en: "Add a document",
    es: "Agregar un documento",
  },
  Type: { en: "Type", es: "Tipo" },
  "Date d'emission (optionnel)": {
    en: "Issue date (optional)",
    es: "Fecha de emision (opcional)",
  },
  "Fin de garantie (optionnel)": {
    en: "Warranty end (optional)",
    es: "Fin de garantia (opcional)",
  },
  "Fournisseur (optionnel)": {
    en: "Supplier (optional)",
    es: "Proveedor (opcional)",
  },
  "Prestataire (optionnel)": {
    en: "Service provider (optional)",
    es: "Proveedor (opcional)",
  },
  "Equipement (optionnel)": {
    en: "Equipment (optional)",
    es: "Equipo (opcional)",
  },
  "Tache liee (optionnel)": {
    en: "Linked task (optional)",
    es: "Tarea vinculada (opcional)",
  },
  "Notes (optionnel)": {
    en: "Notes (optional)",
    es: "Notas (opcional)",
  },
  "PDF ou images jusqu'a 20 Mo.": {
    en: "PDF or images up to 20 MB.",
    es: "PDF o imagenes hasta 20 MB.",
  },
  "Ajouter au coffre": { en: "Add to vault", es: "Agregar al cofre" },
  "Recherche rapide": { en: "Quick search", es: "Busqueda rapida" },
  "Nom, fournisseur, tache, equipement...": {
    en: "Name, supplier, task, equipment...",
    es: "Nombre, proveedor, tarea, equipo...",
  },
  "Marque, boutique, artisan": {
    en: "Brand, shop, contractor",
    es: "Marca, tienda, contratista",
  },
  "Filtrer par type": { en: "Filter by type", es: "Filtrar por tipo" },
  "Tous les types": { en: "All types", es: "Todos los tipos" },
  Rechercher: { en: "Search", es: "Buscar" },
  "Reinitialiser": { en: "Reset", es: "Restablecer" },
  "document affiche": {
    en: "document displayed",
    es: "documento mostrado",
  },
  "documents affiches": {
    en: "documents displayed",
    es: "documentos mostrados",
  },
  "Ajoute le": { en: "Added on", es: "Agregado el" },
  par: { en: "by", es: "por" },
  "Prestataire:": { en: "Vendor:", es: "Proveedor:" },
  "Fournisseur:": { en: "Supplier:", es: "Proveedor:" },
  "Emis le": { en: "Issued on", es: "Emitido el" },
  "Garantie jusqu'au": { en: "Warranty until", es: "Garantia hasta" },
  "Equipement:": { en: "Equipment:", es: "Equipo:" },
  "Tache:": { en: "Task:", es: "Tarea:" },
  "Aucun document enregistre pour le moment.": {
    en: "No documents saved yet.",
    es: "Aun no hay documentos guardados.",
  },
  "Date inconnue": { en: "Unknown date", es: "Fecha desconocida" },
  "Voir le fichier": { en: "View file", es: "Ver archivo" },
  "Aucun document lie pour le moment.": {
    en: "No linked documents yet.",
    es: "Aun no hay documentos vinculados.",
  },
  "Aucun document selectionne": {
    en: "No document selected",
    es: "Ningun documento seleccionado",
  },
  "Formats autorises: PDF et images": {
    en: "Allowed formats: PDF and images",
    es: "Formatos permitidos: PDF e imagenes",
  },
  "Le document depasse 20 Mo": {
    en: "The document exceeds 20 MB",
    es: "El documento supera 20 MB",
  },
  "La date d'emission doit etre au format YYYY-MM-DD": {
    en: "Issue date must be in YYYY-MM-DD format",
    es: "La fecha de emision debe estar en formato YYYY-MM-DD",
  },
  "La date de garantie doit etre au format YYYY-MM-DD": {
    en: "Warranty date must be in YYYY-MM-DD format",
    es: "La fecha de garantia debe estar en formato YYYY-MM-DD",
  },
  Garantie: { en: "Warranty", es: "Garantia" },
  Recu: { en: "Receipt", es: "Recibo" },
  Facture: { en: "Invoice", es: "Factura" },
  Devis: { en: "Quote", es: "Presupuesto" },
};

const WORD_TRANSLATIONS: Record<string, TranslationTarget> = {
  action: { en: "action", es: "accion" },
  actions: { en: "actions", es: "acciones" },
  ajouter: { en: "add", es: "agregar" },
  achat: { en: "purchase", es: "compra" },
  achats: { en: "shopping", es: "compras" },
  annuel: { en: "yearly", es: "anual" },
  annuler: { en: "cancel", es: "cancelar" },
  app: { en: "app", es: "app" },
  article: { en: "item", es: "articulo" },
  articles: { en: "items", es: "articulos" },
  assigner: { en: "assign", es: "asignar" },
  attente: { en: "pending", es: "pendiente" },
  avatar: { en: "avatar", es: "avatar" },
  avec: { en: "with", es: "con" },
  avenir: { en: "upcoming", es: "proximos" },
  calendrier: { en: "calendar", es: "calendario" },
  categorie: { en: "category", es: "categoria" },
  categories: { en: "categories", es: "categorias" },
  choisir: { en: "choose", es: "elegir" },
  clair: { en: "light", es: "claro" },
  commentaire: { en: "comment", es: "comentario" },
  commentaires: { en: "comments", es: "comentarios" },
  connexion: { en: "sign in", es: "iniciar sesion" },
  courses: { en: "shopping", es: "compras" },
  creer: { en: "create", es: "crear" },
  date: { en: "date", es: "fecha" },
  dates: { en: "dates", es: "fechas" },
  debut: { en: "start", es: "inicio" },
  depense: { en: "expense", es: "gasto" },
  depenses: { en: "expenses", es: "gastos" },
  description: { en: "description", es: "descripcion" },
  details: { en: "details", es: "detalles" },
  duree: { en: "duration", es: "duracion" },
  echeance: { en: "deadline", es: "vencimiento" },
  echeances: { en: "deadlines", es: "vencimientos" },
  email: { en: "email", es: "correo" },
  emplacement: { en: "location", es: "ubicacion" },
  enregistrer: { en: "save", es: "guardar" },
  entree: { en: "entry", es: "entrada" },
  entretien: { en: "maintenance", es: "mantenimiento" },
  equipement: { en: "equipment", es: "equipo" },
  equipements: { en: "equipment", es: "equipos" },
  erreur: { en: "error", es: "error" },
  et: { en: "and", es: "y" },
  expiree: { en: "expired", es: "expirada" },
  fait: { en: "done", es: "hecho" },
  fermer: { en: "close", es: "cerrar" },
  foyer: { en: "home", es: "hogar" },
  generation: { en: "generating", es: "generando" },
  ghibli: { en: "Ghibli", es: "Ghibli" },
  icone: { en: "icon", es: "icono" },
  image: { en: "image", es: "imagen" },
  important: { en: "important", es: "importante" },
  installation: { en: "installation", es: "instalacion" },
  invitation: { en: "invitation", es: "invitacion" },
  invitations: { en: "invitations", es: "invitaciones" },
  joindre: { en: "join", es: "unirse" },
  jours: { en: "days", es: "dias" },
  langue: { en: "language", es: "idioma" },
  lien: { en: "link", es: "enlace" },
  liste: { en: "list", es: "lista" },
  listes: { en: "lists", es: "listas" },
  maison: { en: "home", es: "hogar" },
  membre: { en: "member", es: "miembro" },
  membres: { en: "members", es: "miembros" },
  menu: { en: "menu", es: "menu" },
  modifier: { en: "edit", es: "editar" },
  mois: { en: "month", es: "mes" },
  nouveau: { en: "new", es: "nuevo" },
  nouvelle: { en: "new", es: "nueva" },
  ouvrir: { en: "open", es: "abrir" },
  personne: { en: "person", es: "persona" },
  personnes: { en: "people", es: "personas" },
  photo: { en: "photo", es: "foto" },
  pour: { en: "for", es: "para" },
  premiere: { en: "first", es: "primera" },
  proprietaire: { en: "owner", es: "propietario" },
  projet: { en: "project", es: "proyecto" },
  projets: { en: "projects", es: "proyectos" },
  recurrente: { en: "recurring", es: "recurrente" },
  recurrentes: { en: "recurring", es: "recurrentes" },
  revoquee: { en: "revoked", es: "revocada" },
  revenu: { en: "income", es: "ingreso" },
  revenus: { en: "income", es: "ingresos" },
  routine: { en: "routine", es: "rutina" },
  routines: { en: "routines", es: "rutinas" },
  sombre: { en: "dark", es: "oscuro" },
  supprimer: { en: "delete", es: "eliminar" },
  tache: { en: "task", es: "tarea" },
  taches: { en: "tasks", es: "tareas" },
  televerser: { en: "upload", es: "subir" },
  termine: { en: "done", es: "terminado" },
  terminee: { en: "done", es: "terminada" },
  theme: { en: "theme", es: "tema" },
  titre: { en: "title", es: "titulo" },
  utilisateur: { en: "user", es: "usuario" },
  vide: { en: "empty", es: "vacio" },
  zone: { en: "zone", es: "zona" },
  zones: { en: "zones", es: "zonas" },
};

function normalizeLookupKey(value: string) {
  return value
    .replace(/\u2019/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function preserveCase(source: string, translated: string) {
  if (!source) return translated;

  const letters = source.replace(/[^\p{L}]+/gu, "");
  if (letters && letters.toUpperCase() === letters) {
    return translated.toUpperCase();
  }

  const firstLetter = source.match(/\p{L}/u)?.[0] ?? "";
  if (firstLetter && firstLetter === firstLetter.toUpperCase()) {
    return translated.slice(0, 1).toUpperCase() + translated.slice(1);
  }

  return translated;
}

function applyDynamicPatterns(text: string, language: AppLanguage) {
  const statusMatch = text.match(/^Statut:\s*(.+)$/i);
  if (statusMatch) {
    const prefix = language === "en" ? "Status" : "Estado";
    return `${prefix}: ${translateText(statusMatch[1], language)}`;
  }

  const iconMatch = text.match(/^Icone de\s+(.+)$/i);
  if (iconMatch) {
    const prefix = language === "en" ? "Icon of" : "Icono de";
    return `${prefix} ${iconMatch[1]}`;
  }

  const avatarMatch = text.match(/^Avatar de\s+(.+)$/i);
  if (avatarMatch) {
    const prefix = language === "en" ? "Avatar of" : "Avatar de";
    return `${prefix} ${avatarMatch[1]}`;
  }

  const actionsMatch = text.match(/^Actions pour\s+(.+)$/i);
  if (actionsMatch) {
    const prefix = language === "en" ? "Actions for" : "Acciones para";
    return `${prefix} ${actionsMatch[1]}`;
  }

  const deleteMatch = text.match(/^Supprimer\s+(.+)$/i);
  if (deleteMatch) {
    const prefix = language === "en" ? "Delete" : "Eliminar";
    return `${prefix} ${deleteMatch[1]}`;
  }

  const addMatch = text.match(/^Ajouter\s+(.+)$/i);
  if (addMatch) {
    const prefix = language === "en" ? "Add" : "Agregar";
    return `${prefix} ${addMatch[1]}`;
  }

  const illustrationMatch = text.match(/^Illustration\s+(.+)$/i);
  if (illustrationMatch) {
    const prefix = language === "en" ? "Illustration" : "Ilustracion";
    return `${prefix} ${illustrationMatch[1]}`;
  }

  return null;
}

function translateWithWordMap(text: string, language: Exclude<AppLanguage, "fr">) {
  let changed = false;

  const translated = text.replace(/\p{L}[\p{L}'’-]*/gu, (token) => {
    const key = normalizeLookupKey(token.toLowerCase());
    const target = WORD_TRANSLATIONS[key]?.[language];
    if (!target) {
      return token;
    }

    changed = true;
    return preserveCase(token, target);
  });

  return changed ? translated : text;
}

export function translateText(rawValue: string, language: AppLanguage): string {
  if (language === "fr") {
    return rawValue;
  }

  const match = rawValue.match(/^([\t\n\r ]*)([\s\S]*?)([\t\n\r ]*)$/);
  if (!match) return rawValue;

  const prefix = match[1] ?? "";
  const core = match[2] ?? "";
  const suffix = match[3] ?? "";

  if (!core) {
    return rawValue;
  }

  const normalizedCore = normalizeLookupKey(core);
  const exactTranslation =
    EXACT_TRANSLATIONS[normalizedCore]?.[language] ??
    EXACT_TRANSLATIONS[normalizedCore.toLowerCase()]?.[language];
  if (exactTranslation) {
    return `${prefix}${preserveCase(core, exactTranslation)}${suffix}`;
  }

  const dynamicTranslation = applyDynamicPatterns(core, language);
  if (dynamicTranslation) {
    return `${prefix}${dynamicTranslation}${suffix}`;
  }

  const translatedByWords = translateWithWordMap(core, language);
  return `${prefix}${translatedByWords}${suffix}`;
}
