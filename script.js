// Récupérer le formulaire et le message
const form = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    loginMessage.innerText = "Remplir tous les champs";
    return;
  }

  try {
    // Récupérer les utilisateurs depuis json-server
    const res = await fetch('http://localhost:3000/users');
    const users = await res.json();

    // Debug : afficher la liste des utilisateurs
    console.log("Utilisateurs récupérés :", users);

    // Chercher l'utilisateur correspondant
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      loginMessage.innerText = "Email ou mot de passe incorrect";
      return;
    }

    // Stocker l'utilisateur dans localStorage
    localStorage.setItem('user', JSON.stringify(user));

    // Rediriger selon rôle
    switch(user.role) {
      case 'admin':
        window.location.href = 'admin.html';
        break;
      case 'pharmacien':
        window.location.href = 'pharmacien.html';
        break;
      case 'patient':
        window.location.href = 'patient.html';
        break;
      case 'livreur':
        window.location.href = 'livreur.html';
        break;
      default:
        loginMessage.innerText = "Rôle non reconnu";
    }

  } catch (err) {
    console.error(err);
    loginMessage.innerText = "Erreur serveur, vérifier que json-server est lancé";
  }
});
