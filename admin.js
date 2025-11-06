const apiUrl = "http://localhost:3000";
let currentUser = JSON.parse(localStorage.getItem('user'));

// ✅ Redirection si pas connecté
if (!currentUser) {
  window.location.href = "index.html";
}

// ✅ Déconnexion
document.getElementById('btnLogout').onclick = () => {
  localStorage.removeItem('user');
  window.location.href = "index.html";
};

// ------------------- UTILISATEURS -------------------
const fetchUsers = async () => {
  const res = await fetch(`${apiUrl}/users`);
  const users = await res.json();
  const tbody = document.querySelector('#userTable tbody');
  tbody.innerHTML = '';

  // Chargement des pharmacies (pour affichage et assignation)
  const resPharmas = await fetch(`${apiUrl}/pharmacies`);
  const pharmacies = await resPharmas.json();

  users.forEach(u => {
    if (u.role !== 'livreur') {
      const assignedPharma = pharmacies.find(p => p.userId == u.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.nom}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${assignedPharma ? assignedPharma.nom : "Aucune"}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary btnEditUser" data-id="${u.id}">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btnDeleteUser" data-id="${u.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  // ✅ Boutons Modifier
  document.querySelectorAll('.btnEditUser').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const res = await fetch(`${apiUrl}/users/${id}`);
      const user = await res.json();

      document.getElementById('userNom').value = user.nom;
      document.getElementById('userEmail').value = user.email;
      document.getElementById('userPassword').value = user.password;
      document.getElementById('userRole').value = user.role;
      document.getElementById('editUserId').value = id;

      // 🔽 Afficher ou cacher la sélection pharmacie
      const selectDiv = document.getElementById('pharmaSelectDiv');
      if (user.role === 'pharmacien') {
        selectDiv.style.display = 'block';
      } else {
        selectDiv.style.display = 'none';
      }

      // Remplir le <select> des pharmacies : libres ou déjà assignée au pharmacien
      const select = document.getElementById('pharmacySelect');
      select.innerHTML = `<option value="">-- Sélectionner une pharmacie --</option>`;
      pharmacies.forEach(p => {
        if (!p.userId || p.userId == id) {
          select.innerHTML += `<option value="${p.id}">${p.nom}</option>`;
        }
      });

      // Pré-sélectionner la pharmacie du pharmacien s’il en a une
      const assigned = pharmacies.find(p => p.userId == id);
      select.value = assigned ? assigned.id : '';
    };
  });

  // ✅ Boutons Supprimer
  document.querySelectorAll('.btnDeleteUser').forEach(btn => {
    btn.onclick = async () => {
      if (confirm("Supprimer cet utilisateur ?")) {
        await fetch(`${apiUrl}/users/${btn.dataset.id}`, { method: 'DELETE' });

        // Supprimer l’assignation de la pharmacie
        const resPh = await fetch(`${apiUrl}/pharmacies`);
        const pharmacies = await resPh.json();
        for (let p of pharmacies) {
          if (p.userId == btn.dataset.id) {
            await fetch(`${apiUrl}/pharmacies/${p.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: null })
            });
          }
        }
        fetchUsers();
        fetchPharmacies();
      }
    };
  });
};

// ✅ Ajouter / Modifier utilisateur
document.getElementById('btnAddUser').onclick = async () => {
  const nom = document.getElementById('userNom').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const password = document.getElementById('userPassword').value.trim();
  const role = document.getElementById('userRole').value;
  const pharmaId = document.getElementById('pharmacySelect')?.value || null;
  const editId = document.getElementById('editUserId')?.value || '';

  if (!nom || !email || !password) return alert("Veuillez remplir tous les champs.");

  // ✅ Vérifier si la pharmacie est déjà prise
  if (role === 'pharmacien' && pharmaId) {
    const resPh = await fetch(`${apiUrl}/pharmacies`);
    const pharmacies = await resPh.json();
    const pharmaTaken = pharmacies.find(p => p.userId && p.userId != editId && p.id == pharmaId);
    if (pharmaTaken) {
      return alert(`La pharmacie "${pharmaTaken.nom}" est déjà assignée à un autre pharmacien.`);
    }
  }

  let userId = editId;

  if (editId) {
    await fetch(`${apiUrl}/users/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, password, role })
    });
  } else {
    const res = await fetch(`${apiUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, password, role })
    });
    const newUser = await res.json();
    userId = newUser.id;
  }

  // ✅ Si rôle = pharmacien → assigner la pharmacie
  if (role === 'pharmacien' && pharmaId) {
    await fetch(`${apiUrl}/pharmacies/${pharmaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
  }

  // Réinitialisation
  document.getElementById('userNom').value = '';
  document.getElementById('userEmail').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('editUserId').value = '';
  document.getElementById('pharmacySelect').value = '';
  fetchUsers();
  fetchPharmacies();
};

// ------------------- PHARMACIES -------------------
const fetchPharmacies = async () => {
  const res = await fetch(`${apiUrl}/pharmacies`);
  const pharmacies = await res.json();
  const tbody = document.querySelector('#pharmaTable tbody');
  tbody.innerHTML = '';

  pharmacies.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.nom}</td>
      <td>${p.adresse}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary btnEditPharma" data-id="${p.id}">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btnDeletePharma" data-id="${p.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 🔄 Remplir le select pharmacie du formulaire utilisateur avec seulement les pharmacies libres
  const select = document.getElementById('pharmacySelect');
  if (select) {
    select.innerHTML = `<option value="">-- Sélectionner une pharmacie --</option>`;
    pharmacies.forEach(p => {
      if (!p.userId) {
        select.innerHTML += `<option value="${p.id}">${p.nom}</option>`;
      }
    });
  }

  // Modifier pharmacie
  document.querySelectorAll('.btnEditPharma').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const res = await fetch(`${apiUrl}/pharmacies/${id}`);
      const pharma = await res.json();
      document.getElementById('pharmaNom').value = pharma.nom;
      document.getElementById('pharmaQuartier').value = pharma.adresse;
      document.getElementById('editPharmaId').value = id;
    };
  });

  // Supprimer pharmacie
  document.querySelectorAll('.btnDeletePharma').forEach(btn => {
    btn.onclick = async () => {
      if (confirm("Supprimer cette pharmacie ?")) {
        await fetch(`${apiUrl}/pharmacies/${btn.dataset.id}`, { method: 'DELETE' });
        fetchPharmacies();
      }
    };
  });
};

// ------------------- LIVREURS -------------------
const fetchLivreurs = async () => {
  const res = await fetch(`${apiUrl}/users`);
  const users = await res.json();
  const tbody = document.querySelector('#livTable tbody');
  tbody.innerHTML = '';

  users.filter(u => u.role === 'livreur').forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.nom}</td>
      <td>${u.prenom || ''}</td>
      <td>${u.telephone || ''}</td>
      <td>${u.immatriculation || ''}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary btnEditLivreur" data-id="${u.id}">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btnDeleteLivreur" data-id="${u.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

// ------------------- INIT -------------------
fetchUsers();
fetchPharmacies();
fetchLivreurs();
