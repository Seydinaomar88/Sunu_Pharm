const apiUrl = "http://localhost:3000";

// 🧍 Récupération du pharmacien connecté
let currentUser = JSON.parse(localStorage.getItem("user"));
if (!currentUser || currentUser.role !== "pharmacien") {
  window.location.href = "index.html";
}

// 🔓 Déconnexion
document.getElementById('btnLogout').onclick = () => {
  localStorage.removeItem('user');
  window.location.href = "index.html";
};

// ------------------- RÉCUPÉRATION PHARMACIE -------------------
let myPharmacy = null;

const fetchPharmacy = async () => {
  const res = await fetch(`${apiUrl}/pharmacies`);
  const pharmacies = await res.json();
  myPharmacy = pharmacies.find(p => String(p.userId) === String(currentUser.id));

  if (!myPharmacy) return alert("Aucune pharmacie assignée !");
  document.getElementById('pharmaName').innerText = `💊 Pharmacie : ${myPharmacy.nom}`;
};

// ------------------- MÉDICAMENTS -------------------
const fetchMedicaments = async () => {
  const res = await fetch(`${apiUrl}/medicaments`);
  const meds = await res.json();
  const tbody = document.querySelector('#medTable tbody');
  tbody.innerHTML = '';

  meds.filter(m => String(m.pharmacyId) === String(myPharmacy.id))
      .forEach(m => {
        const tr = document.createElement('tr');
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

  // ✏️ Modifier médicament
  document.querySelectorAll('.btnEdit').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const med = await (await fetch(`${apiUrl}/medicaments/${id}`)).json();
      document.getElementById('medNom').value = med.nom;
      document.getElementById('medQuantite').value = med.quantite;
      document.getElementById('medPrix').value = med.prix;
      document.getElementById('editMedId').value = id;
    };
  });

  // 🗑 Supprimer médicament
  document.querySelectorAll('.btnDelete').forEach(btn => {
    btn.onclick = async () => {
      if (confirm("Supprimer ce médicament ?")) {
        await fetch(`${apiUrl}/medicaments/${btn.dataset.id}`, { method: 'DELETE' });
        fetchMedicaments();
      }
    };
  });
};

// ➕ Ajouter / Modifier médicament
document.getElementById('btnAddMed').onclick = async () => {
  const nom = document.getElementById('medNom').value.trim();
  const quantite = Number(document.getElementById('medQuantite').value);
  const prix = Number(document.getElementById('medPrix').value);
  const editId = document.getElementById('editMedId').value;

  if (!nom || !quantite || !prix) return alert("Veuillez remplir tous les champs");

  if (editId) {
    await fetch(`${apiUrl}/medicaments/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, quantite, prix })
    });
    document.getElementById('editMedId').value = '';
  } else {
    await fetch(`${apiUrl}/medicaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, quantite, prix, pharmacyId: myPharmacy.id })
    });
  }

  document.getElementById('medNom').value = '';
  document.getElementById('medQuantite').value = '';
  document.getElementById('medPrix').value = '';
  fetchMedicaments();
};

// ------------------- COMMANDES -------------------
const fetchCommandes = async () => {
  const res = await fetch(`${apiUrl}/orders`);
  const allOrders = await res.json();
  const orders = allOrders.filter(o => String(o.pharmacyId) === String(myPharmacy.id));

  const resUsers = await fetch(`${apiUrl}/users`);
  const users = await resUsers.json();

  const container = document.getElementById('listeCommandes');
  container.innerHTML = '';

  if (!orders.length) {
    container.innerHTML = "<p class='text-center text-muted'>Aucune commande reçue.</p>";
    return;
  }

  orders.forEach(o => {
    const patient = users.find(u => String(u.id) === String(o.patientId));
    const medsListe = o.medicaments.map(m => `${m.nom} (${m.prix} FCFA)`).join(", ");
    const total = o.medicaments.reduce((acc, m) => acc + m.prix, 0);

    const div = document.createElement('div');
    div.className = `card p-3 mb-3 shadow-sm`;

    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="mb-0">Commande #${o.id}</h6>
        <small class="text-muted">${new Date(o.date).toLocaleString()}</small>
      </div>
      <hr>
      <p><strong>👤 Patient :</strong> ${patient?.nom || 'Inconnu'} ${patient?.prenom || ''}</p>
      <p><strong>📞 Téléphone :</strong> ${patient?.telephone || '-'}</p>
      <p><strong>🏠 Adresse :</strong> ${patient?.adresse || '-'}</p>
      <p><strong>💊 Médicaments :</strong> ${medsListe}</p>
      <p><strong>Total :</strong> ${total} FCFA</p>
      <p><strong>Status :</strong> 
        <span class="badge ${o.status === "Confirmée" ? "bg-success" : o.status === "Refusée" ? "bg-danger" : "bg-warning text-dark"}">${o.status}</span>
      </p>
      <div class="mt-2">
        <button class="btn btn-success btn-sm accepter">Accepter ✅</button>
        <button class="btn btn-danger btn-sm refuser">Refuser ❌</button>
        <button class="btn btn-outline-secondary btn-sm supprimer" style="display:none;">🗑 Supprimer</button>
      </div>
    `;

    const accepterBtn = div.querySelector('.accepter');
    const refuserBtn = div.querySelector('.refuser');
    const supprimerBtn = div.querySelector('.supprimer');

    // ✅ Empêcher double confirmation
    if (o.status !== "En attente") {
      accepterBtn.disabled = true;
      refuserBtn.disabled = true;
      supprimerBtn.style.display = "inline-block";
    } else {
      // ✅ Confirmation
      accepterBtn.onclick = async () => {
        accepterBtn.disabled = true;
        refuserBtn.disabled = true;

        // Mise à jour stock
        for (let med of o.medicaments) {
          const medData = await (await fetch(`${apiUrl}/medicaments/${med.id}`)).json();
          await fetch(`${apiUrl}/medicaments/${med.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantite: Math.max(medData.quantite - 1, 0) })
          });
        }

        // Mise à jour statut commande
        await fetch(`${apiUrl}/orders/${o.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: "Confirmée" })
        });

        // 🔔 Notification au patient
        await fetch(`${apiUrl}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Date.now(),
            patientId: o.patientId,
            pharmacyId: myPharmacy.id,
            message: `✅ Votre commande #${o.id} a été confirmée par ${myPharmacy.nom}.`,
            lu: false,
            date: new Date().toISOString()
          })
        });

        fetchCommandes();
        fetchNotifications();
      };

      // ❌ Refus
      refuserBtn.onclick = async () => {
        if (confirm("Refuser cette commande ?")) {
          accepterBtn.disabled = true;
          refuserBtn.disabled = true;

          await fetch(`${apiUrl}/orders/${o.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: "Refusée" })
          });

          await fetch(`${apiUrl}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: Date.now(),
              patientId: o.patientId,
              pharmacyId: myPharmacy.id,
              message: `❌ Votre commande #${o.id} a été refusée par ${myPharmacy.nom}.`,
              lu: false,
              date: new Date().toISOString()
            })
          });

          fetchCommandes();
          fetchNotifications();
        }
      };
    }

    supprimerBtn.onclick = async () => {
      if (confirm("Supprimer cette commande ?")) {
        await fetch(`${apiUrl}/orders/${o.id}`, { method: 'DELETE' });
        fetchCommandes();
      }
    };

    container.appendChild(div);
  });
};

// ------------------- NOTIFICATIONS -------------------
const fetchNotifications = async () => {
  const res = await fetch(`${apiUrl}/notifications`);
  const notes = (await res.json()).filter(n => String(n.pharmacyId) === String(myPharmacy.id) && !n.lu);

  const container = document.getElementById('notifications');
  container.innerHTML = notes.length
    ? notes.map(n => `<div class="alert alert-info mb-1">${n.message}</div>`).join('')
    : "<p class='text-muted text-center'>Aucune notification</p>";
};

// ------------------- INIT -------------------
const init = async () => {
  await fetchPharmacy();
  await fetchMedicaments();
  await fetchCommandes();
  await fetchNotifications();
};

init();

// 🔁 Rafraîchissement automatique
setInterval(() => {
  fetchCommandes();
  fetchNotifications();
}, 5000);
