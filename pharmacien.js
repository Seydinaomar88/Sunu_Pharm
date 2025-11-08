const apiUrl = "http://localhost:3000";

// Récupération du pharmacien connecté
let currentUser = JSON.parse(localStorage.getItem("user"));
if (!currentUser || currentUser.role !== "pharmacien") {
  window.location.href = "index.html";
}

// Déconnexion
document.getElementById("btnLogout").onclick = () => {
  localStorage.removeItem("user");
  window.location.href = "index.html";
};

let myPharmacy = null;
let panierVente = [];

// --- Fonctions utilitaires ---
function badgeClass(status) {
  if (status === "Confirmée") return "badge bg-success";
  if (status === "Refusée") return "badge bg-danger";
  return "badge bg-warning text-dark";
}

// --- PHARMACIE CONNECTÉE ---
const fetchPharmacy = async () => {
  const res = await fetch(`${apiUrl}/pharmacies`);
  const pharmacies = await res.json();
  myPharmacy = pharmacies.find(p => String(p.userId) === String(currentUser.id));
  if (!myPharmacy) return alert("Aucune pharmacie assignée !");
  document.getElementById("pharmaName").innerText = `💊 Pharmacie : ${myPharmacy.nom}`;
};

// --- MÉDICAMENTS ---
const fetchMedicaments = async () => {
  const res = await fetch(`${apiUrl}/medicaments`);
  const meds = await res.json();
  const tbody = document.querySelector("#medTable tbody");
  tbody.innerHTML = "";

  meds.filter(m => String(m.pharmacyId) === String(myPharmacy.id)).forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.nom}</td>
      <td>${m.quantite}</td>
      <td>${m.prix}</td>
      <td class="text-center">
        <button class="btn btn-outline-primary btn-sm btnEdit" data-id="${m.id}"><i class="fas fa-pen"></i></button>
        <button class="btn btn-outline-danger btn-sm btnDelete" data-id="${m.id}"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btnEdit").forEach(btn => {
    btn.onclick = async () => {
      const med = await (await fetch(`${apiUrl}/medicaments/${btn.dataset.id}`)).json();
      document.getElementById("medNom").value = med.nom;
      document.getElementById("medQuantite").value = med.quantite;
      document.getElementById("medPrix").value = med.prix;
      document.getElementById("editMedId").value = med.id;
    };
  });

  document.querySelectorAll(".btnDelete").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Supprimer ce médicament ?")) return;
      await fetch(`${apiUrl}/medicaments/${btn.dataset.id}`, { method: "DELETE" });
      fetchMedicaments();
    };
  });
};

// Ajouter / Modifier médicament
document.getElementById("btnAddMed").onclick = async () => {
  const nom = document.getElementById("medNom").value.trim();
  const quantite = Number(document.getElementById("medQuantite").value);
  const prix = Number(document.getElementById("medPrix").value);
  const editId = document.getElementById("editMedId").value;

  if (!nom || !quantite || !prix) return alert("Veuillez remplir tous les champs");

  const data = { nom, quantite, prix, pharmacyId: myPharmacy.id };
  if (editId) await fetch(`${apiUrl}/medicaments/${editId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  else await fetch(`${apiUrl}/medicaments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  document.getElementById("medNom").value = "";
  document.getElementById("medQuantite").value = "";
  document.getElementById("medPrix").value = "";
  document.getElementById("editMedId").value = "";
  fetchMedicaments();
};

// --- COMMANDES EN LIGNE ---
const fetchCommandes = async () => {
  const res = await fetch(`${apiUrl}/orders`);
  const allOrders = await res.json();
  const orders = allOrders.filter(o => String(o.pharmacyId) === String(myPharmacy.id));
  const container = document.getElementById("listeCommandes");
  container.innerHTML = "";

  for (const o of orders) {
    const medsListe = o.medicaments.map(m => `${m.nom} x${m.quantite || 1} (${m.prix} FCFA)`).join(", ");
    const total = o.medicaments.reduce((acc, m) => acc + m.prix * (m.quantite || 1), 0);

    const div = document.createElement("div");
    div.className = "card p-3 mb-3 shadow-sm";
    div.innerHTML = `
      <p><strong>👤 Patient :</strong> ${o.patientNom || "Inconnu"} ${o.patientPrenom || ""}</p>
      <p><strong>📞 Téléphone :</strong> ${o.patientTelephone || "-"}</p>
      <p><strong>🏠 Adresse :</strong> ${o.patientAdresse || "-"}</p>
      <p><strong>💊 Médicaments :</strong> ${medsListe}</p>
      <p><strong>Total :</strong> ${total} FCFA</p>
      <p><strong>Status :</strong> <span class="${badgeClass(o.status)}">${o.status}</span></p>
      <div class="mt-2">
        <button class="btn btn-success btn-sm accepter">Accepter ✅</button>
        <button class="btn btn-danger btn-sm refuser">Refuser ❌</button>
        <button class="btn btn-secondary btn-sm vendre" style="display:none;">💰 Enregistrer Vente</button>
        <button class="btn btn-info btn-sm downloadTicket" style="display:inline-block;">📄 Télécharger Facture</button>
      </div>
    `;

    const accBtn = div.querySelector(".accepter");
    const refBtn = div.querySelector(".refuser");
    const vendreBtn = div.querySelector(".vendre");
    const downloadBtn = div.querySelector(".downloadTicket");

    if (o.status === "Confirmée") {
      accBtn.disabled = true;
      refBtn.disabled = true;
      vendreBtn.style.display = "inline-block";
    }

    accBtn.onclick = () => handleCommande(o, "Confirmée", div);
    refBtn.onclick = () => handleCommande(o, "Refusée", div);
    vendreBtn.onclick = () => enregistrerVente(o);
    downloadBtn.onclick = async () => {
      genererFacturePDF({
        ...o,
        total
      });
    };

    container.appendChild(div);
  }
};

// Confirmation commande
async function handleCommande(order, status, div) {
  const accBtn = div.querySelector(".accepter");
  const refBtn = div.querySelector(".refuser");
  accBtn.disabled = true;
  refBtn.disabled = true;

  if (status === "Confirmée") {
    for (const med of order.medicaments) {
      const medData = await (await fetch(`${apiUrl}/medicaments/${med.id}`)).json();
      await fetch(`${apiUrl}/medicaments/${med.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantite: Math.max(medData.quantite - (med.quantite || 1), 0) })
      });
    }
  }

  await fetch(`${apiUrl}/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });

  fetchCommandes();
}

// Enregistrer une vente depuis commande en ligne
async function enregistrerVente(order) {
  const total = order.medicaments.reduce((a, m) => a + m.prix * (m.quantite || 1), 0);

  const ventesExist = await (await fetch(`${apiUrl}/ventes`)).json();
  const venteExistante = ventesExist.find(v => String(v.commandeId) === String(order.id));
  if (venteExistante) return alert("⚠️ Cette commande a déjà été enregistrée !");

  const vente = {
    id: Date.now(),
    commandeId: order.id,
    pharmacyId: myPharmacy.id,
    patientNom: order.patientNom,
    patientPrenom: order.patientPrenom,
    patientAdresse: order.patientAdresse,
    patientTelephone: order.patientTelephone,
    medicaments: order.medicaments,
    total,
    date: new Date().toISOString()
  };

  await fetch(`${apiUrl}/ventes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vente)
  });

  panierVente = [];
  fetchVentes();
  alert(`✅ Vente enregistrée ! Total : ${total} FCFA`);
}

// --- VENTE SUR PLACE ---
document.getElementById("btnAjouterVenteMed").onclick = () => {
  const nom = document.getElementById("venteMedNom").value.trim();
  const quantite = Number(document.getElementById("venteMedQuantite").value);
  const prix = Number(document.getElementById("venteMedPrix").value);

  if (!nom || !quantite || !prix) return alert("Veuillez remplir tous les champs");

  panierVente.push({ nom, quantite, prix });
  afficherPanierVente();

  document.getElementById("venteMedNom").value = "";
  document.getElementById("venteMedQuantite").value = "";
  document.getElementById("venteMedPrix").value = "";
};

function afficherPanierVente() {
  const container = document.getElementById("medsVente");
  container.innerHTML = "";
  let total = 0;

  panierVente.forEach((m, i) => {
    total += m.prix * m.quantite;
    const div = document.createElement("div");
    div.className = "d-flex justify-content-between mb-1";
    div.innerHTML = `
      <span>${m.nom} x${m.quantite} - ${m.prix} FCFA</span>
      <button class="btn btn-sm btn-danger" data-index="${i}">Supprimer</button>
    `;
    div.querySelector("button").onclick = () => {
      panierVente.splice(i, 1);
      afficherPanierVente();
    };
    container.appendChild(div);
  });

  document.getElementById("totalVente").innerText = total + " FCFA";
}

// Valider vente sur place
document.getElementById("btnValiderVente").onclick = async () => {
  const patientNom = document.getElementById("patientNom").value.trim();
  const patientPrenom = document.getElementById("patientPrenom").value.trim();
  const patientTelephone = document.getElementById("patientTelephone").value.trim();
  const patientAdresse = document.getElementById("patientAdresse").value.trim();

  if (!patientNom || !patientPrenom || !patientTelephone || !patientAdresse)
    return alert("Veuillez remplir toutes les informations du patient.");

  if (panierVente.length === 0) return alert("Veuillez ajouter au moins un médicament.");

  const total = panierVente.reduce((acc, m) => acc + m.prix * m.quantite, 0);

  // Mise à jour du stock
  for (const m of panierVente) {
    const medsStock = await (await fetch(`${apiUrl}/medicaments`)).json();
    const medStock = medsStock.find(med => med.nom === m.nom && String(med.pharmacyId) === String(myPharmacy.id));
    if (medStock) {
      await fetch(`${apiUrl}/medicaments/${medStock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantite: Math.max(medStock.quantite - m.quantite, 0) })
      });
    }
  }

  const vente = {
    id: Date.now(),
    pharmacyId: myPharmacy.id,
    patientNom,
    patientPrenom,
    patientAdresse,
    patientTelephone,
    medicaments: panierVente,
    total,
    date: new Date().toISOString()
  };

  await fetch(`${apiUrl}/ventes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vente)
  });

  genererFacturePDF(vente); // Téléchargement automatique

  panierVente = [];
  afficherPanierVente();
  document.getElementById("patientNom").value = "";
  document.getElementById("patientPrenom").value = "";
  document.getElementById("patientTelephone").value = "";
  document.getElementById("patientAdresse").value = "";

  fetchVentes();
  alert("✅ Vente sur place enregistrée !");
};

// --- AFFICHAGE DES VENTES ---
async function fetchVentes() {
  const res = await fetch(`${apiUrl}/ventes`);
  const ventes = (await res.json()).filter(v => String(v.pharmacyId) === String(myPharmacy.id));
  const container = document.getElementById("listeVentes");

  if (!ventes.length) return (container.innerHTML = "<p class='text-muted'>Aucune vente enregistrée.</p>");

  container.innerHTML = ventes.map(v => {
    const medsListe = v.medicaments.map(m => `${m.nom} x${m.quantite || 1} - ${m.prix} FCFA`).join(", ");
    return `
      <div class="card p-3 mb-2 shadow-sm">
        <p><strong>🧾 Vente #${v.id}</strong></p>
        <p>👤 ${v.patientNom} ${v.patientPrenom}</p>
        <p>📞 ${v.patientTelephone || "-"}</p>
        <p>🏠 ${v.patientAdresse || "-"}</p>
        <p>💊 Médicaments : ${medsListe}</p>
        <p>Total : ${v.total} FCFA</p>
        <p>Date : ${new Date(v.date).toLocaleString()}</p>
        <button class="btn btn-info btn-sm btnDownload" data-id="${v.id}">📄 Télécharger facture</button>
      </div>
    `;
  }).join("");

  // Boutons téléchargement facture
  document.querySelectorAll(".btnDownload").forEach(btn => {
    btn.onclick = async () => {
      const venteId = btn.dataset.id;
      const vente = (await (await fetch(`${apiUrl}/ventes/${venteId}`)).json());
      genererFacturePDF(vente);
    };
  });
}

// --- FACTURE PDF ---
function genererFacturePDF(vente) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("🧾 FACTURE DE VENTE", 70, 15);
  doc.setFontSize(12);
  doc.text(`Pharmacie : ${myPharmacy.nom}`, 10, 30);
  doc.text(`Client : ${vente.patientNom} ${vente.patientPrenom}`, 10, 40);
  doc.text(`Téléphone : ${vente.patientTelephone || "-"}`, 10, 50);
  doc.text(`Adresse : ${vente.patientAdresse || "-"}`, 10, 60);
  doc.text(`Date : ${new Date(vente.date).toLocaleString()}`, 10, 70);

  let y = 85;
  doc.setFontSize(12);
  doc.text("Médicament", 10, y);
  doc.text("Qté", 100, y);
  doc.text("Prix", 130, y);
  doc.text("Total", 160, y);
  y += 10;

  vente.medicaments.forEach(m => {
    doc.text(m.nom, 10, y);
    doc.text(`${m.quantite || 1}`, 100, y);
    doc.text(`${m.prix}`, 130, y);
    doc.text(`${(m.prix * (m.quantite || 1))}`, 160, y);
    y += 10;
  });

  doc.setFontSize(14);
  doc.text(`Montant Total : ${vente.total} FCFA`, 10, y + 10);
  doc.save(`facture_${vente.patientNom}_${vente.patientPrenom}.pdf`);
}

// --- INIT ---
const init = async () => {
  await fetchPharmacy();
  await fetchMedicaments();
  await fetchCommandes();
  fetchVentes();
};

init();
