const apiUrl = "http://localhost:3000";
let currentUser = JSON.parse(localStorage.getItem('user'));

// Redirection si pas connecté ou pas pharmacien
if (!currentUser || currentUser.role !== 'pharmacien') {
  window.location.href = "index.html";
}

// Déconnexion
document.getElementById('btnLogout').onclick = () => {
  localStorage.removeItem('user');
  window.location.href = "index.html";
};

// ------------------- PHARMACIE DU PHARMACIEN -------------------
let myPharmacy = null;

const fetchPharmacy = async () => {
  const res = await fetch(`${apiUrl}/pharmacies`);
  const pharmacies = await res.json();
  myPharmacy = pharmacies.find(p => String(p.userId) === String(currentUser.id));

  if (!myPharmacy) return alert("Aucune pharmacie assignée !");
  document.getElementById('pharmaName').innerText = `Pharmacie: ${myPharmacy.nom}`;
};

// ------------------- MÉDICAMENTS -------------------
const fetchMedicaments = async () => {
  const res = await fetch(`${apiUrl}/medicaments`);
  const meds = await res.json();

  const tbody = document.querySelector('#medTable tbody');
  tbody.innerHTML = '';

  meds
    .filter(m => String(m.pharmacyId) === String(myPharmacy.id))
    .forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${m.nom}</td>
        <td>${m.quantite}</td>
        <td>${m.prix}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary btnEditMed" data-id="${m.id}" title="Modifier">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btnDeleteMed" data-id="${m.id}" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  // Modifier
  document.querySelectorAll('.btnEditMed').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const res = await fetch(`${apiUrl}/medicaments/${id}`);
      const med = await res.json();

      document.getElementById('medNom').value = med.nom;
      document.getElementById('medQuantite').value = med.quantite;
      document.getElementById('medPrix').value = med.prix;
      document.getElementById('editMedId').value = id;
    };
  });

  // Supprimer
  document.querySelectorAll('.btnDeleteMed').forEach(btn => {
    btn.onclick = async () => {
      if(confirm("Supprimer ce médicament ?")) {
        await fetch(`${apiUrl}/medicaments/${btn.dataset.id}`, { method:'DELETE' });
        fetchMedicaments();
      }
    };
  });
};

// Ajouter / Modifier
document.getElementById('btnAddMed').onclick = async () => {
  const nom = document.getElementById('medNom').value.trim();
  const quantite = Number(document.getElementById('medQuantite').value);
  const prix = Number(document.getElementById('medPrix').value);
  const editId = document.getElementById('editMedId').value;

  if (!nom || !quantite || !prix) return alert("Remplir tous les champs");

  if(editId){
    await fetch(`${apiUrl}/medicaments/${editId}`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({nom, quantite, prix})
    });
    document.getElementById('editMedId').value = '';
  } else {
    await fetch(`${apiUrl}/medicaments`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({nom, quantite, prix, pharmacyId: myPharmacy.id})
    });
  }

  document.getElementById('medNom').value = '';
  document.getElementById('medQuantite').value = '';
  document.getElementById('medPrix').value = '';
  fetchMedicaments();
};

// ------------------- INIT -------------------
const init = async () => {
  await fetchPharmacy();
  fetchMedicaments();
};
init();
