const apiUrl = "http://localhost:3000";
let currentUser = JSON.parse(localStorage.getItem("user"));

if (!currentUser || currentUser.role !== "patient") {
  window.location.href = "index.html";
}

// Déconnexion
document.getElementById("btnLogout").onclick = () => {
  localStorage.removeItem("user");
  window.location.href = "index.html";
};

// ------------------- Navigation -------------------
const btnManuel = document.getElementById("btnManuel");
const btnImage = document.getElementById("btnImage");
const btnMesCommandes = document.getElementById("btnMesCommandes");
const formManuel = document.getElementById("formManuel");
const formImage = document.getElementById("formImage");
const resultats = document.getElementById("resultats");
const listePharmacies = document.getElementById("listePharmacies");
const sectionCommandes = document.getElementById("sectionCommandes");
const listeCommandes = document.getElementById("listeCommandes");

btnManuel.onclick = () => {
  formManuel.classList.remove("d-none");
  formImage.classList.add("d-none");
  sectionCommandes.classList.add("d-none");
  resultats.classList.add("d-none");
};

btnImage.onclick = () => {
  formImage.classList.remove("d-none");
  formManuel.classList.add("d-none");
  sectionCommandes.classList.add("d-none");
  resultats.classList.add("d-none");
};

btnMesCommandes.onclick = () => {
  sectionCommandes.classList.remove("d-none");
  formManuel.classList.add("d-none");
  formImage.classList.add("d-none");
  resultats.classList.add("d-none");
  fetchCommandes();
};

// ------------------- Normalisation -------------------
const normalizeString = str =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ------------------- Envoyer ordonnance -------------------
formManuel.addEventListener("submit", e => { e.preventDefault(); envoyerOrdonnance("manuel"); });
formImage.addEventListener("submit", e => { e.preventDefault(); envoyerOrdonnance("image"); });

async function envoyerOrdonnance(type) {
  let medicaments =
    type === "manuel"
      ? document.getElementById("medicaments").value.split(",").map(m => normalizeString(m.trim()))
      : ["paracetamol", "vitamine c"]; // simulation OCR

  medicaments = medicaments.filter(m => m);
  if (!medicaments.length) return alert("Veuillez entrer au moins un médicament");

  const pharmacies = await (await fetch(`${apiUrl}/pharmacies`)).json();
  const stock = await (await fetch(`${apiUrl}/medicaments`)).json();
  listePharmacies.innerHTML = "";

  let found = false;

  for (let ph of pharmacies) {
    const medsDisponibles = stock.filter(
      s =>
        String(s.pharmacyId) === String(ph.id) &&
        medicaments.includes(normalizeString(s.nom)) &&
        s.quantite > 0
    );

    if (medsDisponibles.length === 0) continue;
    found = true;

    const total = medsDisponibles.reduce((acc, m) => acc + m.prix, 0);
    const dispo = medsDisponibles.length === medicaments.length
      ? "✅ Tous disponibles"
      : "⚠️ Partiellement disponible";

    const div = document.createElement("div");
    div.classList.add("col-md-6");
    div.innerHTML = `
      <div class="card p-3 shadow-sm mb-3">
        <h5>${ph.nom}</h5>
        <p><small>${ph.adresse}</small></p>
        <p>${dispo}</p>
        <ul>${medsDisponibles.map(m => `<li>${m.nom} - ${m.prix} FCFA</li>`).join("")}</ul>
        <p><strong>Total :</strong> ${total} FCFA</p>
        <button class="btn btn-success w-100 confirmer">Confirmer ma commande ✅</button>
      </div>
    `;

    // Bouton confirmer
    div.querySelector(".confirmer").onclick = async () => {
      const commande = {
        id: Date.now(),
        patientId: currentUser.id,
        patientNom: currentUser.nom || "Inconnu",
        patientPrenom: currentUser.prenom || "",
        patientTelephone: currentUser.telephone || "",
        patientAdresse: currentUser.adresse || "",
        pharmacyId: ph.id,
        pharmacyNom: ph.nom,
        medicaments: medsDisponibles.map(m => ({ id: m.id, nom: m.nom, prix: m.prix })),
        status: "En attente",
        date: new Date().toISOString()
      };

      // Enregistrer la commande
      await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commande)
      });

      // Notification complète au pharmacien
      await fetch(`${apiUrl}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Date.now(),
          pharmacyId: ph.id,
          type: "nouvelle_commande",
          message: `
👤 Patient : ${currentUser.nom} ${currentUser.prenom || ""}
📞 Téléphone : ${currentUser.telephone || "-"}
📍 Adresse : ${currentUser.adresse || "-"}
💊 Médicaments : ${commande.medicaments.map(m => `${m.nom} (${m.prix} FCFA)`).join(", ")}
💰 Total : ${total} FCFA
📦 Statut : En attente
          `,
          date: new Date().toISOString(),
          lu: false
        })
      });

      alert(`✅ Commande envoyée à ${ph.nom}`);
      formManuel.reset();
      formImage.reset();
      resultats.classList.add("d-none");
      fetchCommandes();
    };

    listePharmacies.appendChild(div);
  }

  if (!found) {
    listePharmacies.innerHTML = "<p class='text-center text-muted'>🏥 Aucune pharmacie ne peut fournir les médicaments demandés.</p>";
  }

  resultats.classList.remove("d-none");
}

// ------------------- Affichage des commandes du patient -------------------
async function fetchCommandes() {
  const res = await fetch(`${apiUrl}/orders`);
  let orders = (await res.json()).filter(o => String(o.patientId) === String(currentUser.id));

  listeCommandes.innerHTML = "";
  if (!orders.length) {
    listeCommandes.innerHTML = "<p class='text-center text-muted'>Aucune commande trouvée.</p>";
    return;
  }

  orders.sort((a, b) => new Date(b.date) - new Date(a.date));

  orders.forEach(o => {
    const medsListe = o.medicaments.map(m => `${m.nom} - ${m.prix} FCFA`).join("<br>");
    const total = o.medicaments.reduce((acc, m) => acc + m.prix, 0);

    const div = document.createElement("div");
    div.classList.add("card", "p-3", "mb-3");
    div.innerHTML = `
      <p><strong>Pharmacie :</strong> ${o.pharmacyNom || "-"}</p>
      <p><strong>Médicaments :</strong><br>${medsListe}</p>
      <p><strong>Total :</strong> ${total} FCFA</p>
      <p><strong>Date :</strong> ${new Date(o.date).toLocaleString()}</p>
      <p><strong>Status :</strong> 
        <span class="badge ${o.status === "Confirmée" ? "bg-success" : o.status === "Refusée" ? "bg-danger" : "bg-warning text-dark"}">${o.status}</span>
      </p>
    `;
    listeCommandes.appendChild(div);
  });
}

// Rafraîchissement auto toutes les 5 secondes
setInterval(fetchCommandes, 5000);
