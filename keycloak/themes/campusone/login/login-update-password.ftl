<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set New Password — CampusOne</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body>

<div class="kc-card">

  <div class="kc-brand">
    <div class="kc-brand-icon">🛡️</div>
    <h1>CampusOne</h1>
    <p>IIT Bombay Campus Portal</p>
  </div>

  <div class="kc-title">Set a new password</div>

  <#if message?has_content>
    <div class="kc-alert kc-alert--${message.type}">
      <span class="kc-alert-icon"><#if message.type == 'error'>⚠️<#elseif message.type == 'success'>✅<#else>ℹ️</#if></span>
      <span>${message.summary}</span>
    </div>
  </#if>

  <form class="kc-form" action="${url.loginAction}" method="post">

    <div class="kc-field">
      <label class="kc-label" for="password-new">New password</label>
      <div class="kc-input-wrap">
        <span class="kc-input-icon">🔒</span>
        <input class="kc-input<#if messagesPerField.existsError('password','password-confirm')> kc-input--error</#if>"
          type="password" id="password-new" name="password-new"
          autocomplete="new-password" autofocus
          placeholder="create a strong password"
          oninput="checkStrength(this.value)">
        <button type="button" class="kc-eye-btn" onclick="togglePw('password-new',this)" title="Show/hide">👁</button>
      </div>
      <div class="kc-strength">
        <div class="kc-strength-bar"><div class="kc-strength-fill" id="strength-fill"></div></div>
        <span class="kc-strength-label" id="strength-label"></span>
      </div>
      <#if messagesPerField.existsError('password')>
        <span class="kc-field-error">${messagesPerField.get('password')}</span>
      </#if>
    </div>

    <div class="kc-field">
      <label class="kc-label" for="password-confirm">Confirm password</label>
      <div class="kc-input-wrap">
        <span class="kc-input-icon">🔒</span>
        <input class="kc-input<#if messagesPerField.existsError('password-confirm')> kc-input--error</#if>"
          type="password" id="password-confirm" name="password-confirm"
          autocomplete="new-password" placeholder="repeat your password">
        <button type="button" class="kc-eye-btn" onclick="togglePw('password-confirm',this)" title="Show/hide">👁</button>
      </div>
      <#if messagesPerField.existsError('password-confirm')>
        <span class="kc-field-error">${messagesPerField.get('password-confirm')}</span>
      </#if>
    </div>

    <label class="kc-checkbox-label" style="margin-top:-0.25rem;">
      <input type="checkbox" name="logout-sessions" value="on" checked>
      Sign out of all other devices
    </label>

    <button class="kc-btn" type="submit">Update Password →</button>

  </form>

</div>

<script>
  function togglePw(id, btn) {
    var i = document.getElementById(id);
    if (i.type === 'password') { i.type = 'text'; btn.textContent = '🙈'; }
    else { i.type = 'password'; btn.textContent = '👁'; }
  }
  function checkStrength(pw) {
    var fill = document.getElementById('strength-fill');
    var label = document.getElementById('strength-label');
    if (!fill) return;
    var score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    var pct    = (score / 5) * 100;
    var colors = ['#EF4444','#F59E0B','#F59E0B','#10B981','#10B981'];
    var labels = ['','Weak','Fair','Good','Strong'];
    fill.style.width      = pct + '%';
    fill.style.background = colors[Math.max(score-1,0)];
    label.textContent     = score > 0 ? labels[Math.min(score,4)] : '';
    label.style.color     = colors[Math.max(score-1,0)];
  }
</script>

</body>
</html>
