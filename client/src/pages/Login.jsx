import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Clock, KeyRound, Lock, Mail, MapPin, UserCog, Users, ShieldAlert } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Button, Field, FlatPicker, Input, MobileInput, StructureChips } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { flatApi } from '../lib/api.js';
import { ROLES, ROLE_META, flatIdFor } from '../lib/constants.js';
import { isValidMobile } from '../lib/validation.js';

const DEFAULT_FLAT = { block: 'A', floor: 1, flatId: flatIdFor('A', 1, 1) };

const ROLE_ICONS = { RESIDENT: Users, ADMIN: UserCog, GUARD: ShieldAlert };

export default function Login() {
  const { login, register, demoLogin, loading } = useAuth();
  const [mode, setMode] = useState('LOGIN');
  const [role, setRole] = useState('RESIDENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [householdCount, setHouseholdCount] = useState(1);
  const [familyMembers, setFamilyMembers] = useState(['']);
  const [contactNumber, setContactNumber] = useState('');
  const [flat, setFlat] = useState(DEFAULT_FLAT);
  const [securityCode, setSecurityCode] = useState('');
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [availableFlats, setAvailableFlats] = useState(null);

  // New Registration may only choose a flat that has no account yet.
  useEffect(() => {
    let alive = true;
    flatApi
      .available()
      .then((data) => {
        if (!alive) return;
        setAvailableFlats(data.available || []);
        if (data.available?.length) {
          const first = data.available[0];
          setFlat({ block: first[0], floor: Number(first[2]), flatId: first });
        }
      })
      .catch(() => alive && setAvailableFlats([]));
    return () => {
      alive = false;
    };
  }, []);

  const selectRole = (next) => {
    setRole(next);
    setError('');
  };

  const updateHouseholdCount = (value) => {
    if (value === '') {
      setHouseholdCount('');
      return;
    }
    const count = Number(value);
    // Reject out-of-range input immediately (including pasted values/spinner changes).
    if (!Number.isInteger(count) || count < 1 || count > 6) return;
    setHouseholdCount(count);
    setFamilyMembers((current) => Array.from({ length: count }, (_, index) => current[index] || ''));
  };

  const updateFamilyMember = (index, value) => {
    setFamilyMembers((current) => current.map((member, memberIndex) => memberIndex === index ? value : member));
    if (index === 0) setName(value);
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setPending(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'REGISTER' && role === 'RESIDENT') {
      const count = Number(householdCount);
      const names = familyMembers.slice(0, count).map((member) => member.trim());
      if (!Number.isInteger(count) || count < 1 || count > 6 || names.length !== count) {
        setError('Enter between 1 and 6 household members.');
        return;
      }
      if (names.some((member) => !member)) {
        setError('Enter the name of every household member.');
        return;
      }
      if (names[0].toLowerCase() !== name.trim().toLowerCase()) {
        setError('Member 1 must be the resident who is registering.');
        return;
      }
    }

    // Client-side guard for the 10-digit mobile rule before hitting the API
    if (mode === 'REGISTER' && !isValidMobile(contactNumber)) {
      setError('Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9');
      return;
    }

    try {
      if (mode === 'LOGIN') {
        await login(email, password);
      } else {
        const result = await register({
          name,
          email,
          password,
          role,
          familyMembers: role === 'RESIDENT' ? familyMembers.slice(0, Number(householdCount)).map((member) => member.trim()) : [],
          contactNumber,
          flatId: role === 'RESIDENT' ? flat.flatId : undefined,
          securityCode: role === 'RESIDENT' ? undefined : securityCode,
          staffId: role === 'RESIDENT' ? undefined : staffId,
        });
        // Residents & guards need admin approval before they can sign in.
        if (result?.pending) {
          setPending({ name: result.user?.name, role: result.user?.role, email: result.user?.email });
          setPassword('');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check details.');
    }
  };

  const RoleIcon = ROLE_ICONS[role];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto space-y-5 relative">
        <div className="text-center space-y-3">
          <div className="max-w-[280px] sm:max-w-[320px] mx-auto animate-fade-in">
            <Logo variant="full" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Next-Gen Society OS
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-center gap-1.5">
              <MapPin className="w-3 h-3" /> Khodaldham Society • Ahmedabad
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs p-5 sm:p-6 space-y-5">
          <div className="space-y-2.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">
              1-Click Demo Evaluation Logins
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((item) => {
                const Icon = ROLE_ICONS[item];
                const meta = ROLE_META[item];
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      selectRole(item);
                      switchMode('LOGIN');
                      demoLogin(item).catch((err) => setError(err.message));
                    }}
                    disabled={loading}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 disabled:opacity-60 ${meta.chip} hover:shadow-xs`}
                  >
                    <Icon className="w-4 h-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              or use credentials
            </span>
          </div>

          {mode === 'REGISTER' && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Role</div>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
              {ROLES.map((item) => {
                const Icon = ROLE_ICONS[item];
                const active = role === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectRole(item)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
                      active ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {ROLE_META[item].label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 font-medium text-center">{ROLE_META[role].blurb}</p>
          </div>
          )}

          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {['LOGIN', 'REGISTER'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => switchMode(item)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  mode === item ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item === 'LOGIN' ? 'Sign In' : 'New Registration'}
              </button>
            ))}
          </div>

          {pending ? (
            <div className="space-y-3.5">
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50">
                <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900">Registration sent for admin approval</h4>
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                    Thanks <strong>{pending.name}</strong> — your <strong>{pending.role.toLowerCase()}</strong> account
                    is now in the society admin's approval queue. You will be able to sign in with{' '}
                    <span className="font-mono">{pending.email}</span> as soon as the admin approves it.
                  </p>
                </div>
              </div>
              <ul className="text-[11px] text-slate-500 font-medium space-y-1 pl-1">
                <li>• The admin portal shows pending registrations under <strong>User Approvals</strong>.</li>
                <li>• No portal access is granted until the request is approved.</li>
              </ul>
              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full"
                icon={ArrowLeft}
                onClick={() => switchMode('LOGIN')}
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'REGISTER' && (
              <Field label="Full Name">
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <Input
                    required
                    className="!pl-10"
                    placeholder="e.g. Aarav Patel"
                    value={name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setName(value);
                      setFamilyMembers((current) => [value, ...current.slice(1)]);
                    }}
                  />
                </div>
              </Field>
            )}

            {mode === 'REGISTER' && role === 'RESIDENT' && (
              <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
                <Field label="People living in this home" hint="Include yourself • Enter a number from 1 to 6">
                  <Input
                    required
                    type="number"
                    min="1"
                    max="6"
                    step="1"
                    value={householdCount}
                    onChange={(event) => updateHouseholdCount(event.target.value)}
                    placeholder="1 to 6"
                  />
                </Field>
                <div className="space-y-2.5">
                  {Array.from({ length: Math.max(1, Math.min(Number(householdCount) || 1, 6)) }, (_, index) => (
                    <Field key={index} label={`Member ${index + 1} name${index === 0 ? ' (account holder)' : ''}`}>
                      <Input
                        required
                        placeholder={index === 0 ? 'Resident account holder name' : `Name of household member ${index + 1}`}
                        value={familyMembers[index] ?? (index === 0 ? name : '')}
                        onChange={(event) => updateFamilyMember(index, event.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            <Field label="Email Address">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <Input
                  required
                  type="email"
                  className="!pl-10"
                  placeholder="name@homi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <Input
                  required
                  type="password"
                  className="!pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </Field>

            {mode === 'REGISTER' && (
              <>
                <Field label="Contact Number">
                  <MobileInput value={contactNumber} onChange={setContactNumber} required />
                </Field>

                {role === 'RESIDENT' ? (
                  <div className="space-y-2">
                    <FlatPicker
                      block={flat.block}
                      floor={flat.floor}
                      flatId={flat.flatId}
                      onChange={(next) => setFlat({ ...flat, ...next })}
                      hint="Block → Floor → Flat"
                      available={availableFlats}
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      Your home: <strong className="text-slate-600 font-mono">{flat.flatId}</strong> • Block{' '}
                      {flat.block}, Floor {flat.floor}
                    </p>
                    <p className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                      {availableFlats === null
                        ? 'Checking which flats are still available…'
                        : `${availableFlats.length} of 60 flats are unregistered — flats that already have an account are hidden.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    <Field
                      label={role === 'ADMIN' ? 'Admin Master Security Code' : 'Guard Staff Pass Code'}
                      hint={role === 'ADMIN' ? 'Demo master code: ADM-001' : 'Demo staff code: SEC-001'}
                    >
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <Input
                          required
                          className="!pl-10"
                          placeholder={role === 'ADMIN' ? 'ADM-001' : 'SEC-001'}
                          value={securityCode}
                          onChange={(e) => setSecurityCode(e.target.value.toUpperCase())}
                        />
                      </div>
                    </Field>
                    <Field label="Staff ID (Optional)">
                      <Input placeholder="SEC-014" value={staffId} onChange={(e) => setStaffId(e.target.value)} />
                    </Field>
                  </div>
                )}
              </>
            )}

            {error && (
              <div
                className={`text-[11px] font-semibold rounded-xl px-3.5 py-2.5 leading-relaxed border flex items-start gap-2 ${
                  /approval|approved|rejected/i.test(error)
                    ? 'text-amber-800 bg-amber-50 border-amber-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}
              >
                {/approval|approved|rejected/i.test(error) && <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" size="xl" className="w-full" icon={mode === 'LOGIN' ? Lock : RoleIcon} disabled={loading}>
              {loading
                ? 'Verifying…'
                : mode === 'LOGIN'
                  ? 'Sign In'
                  : `Register as ${ROLE_META[role].label.toUpperCase()}`}
            </Button>
          </form>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <StructureChips />
          <p className="text-center text-[10px] text-slate-400 font-medium">
            HOMI — Integrated Home &amp; Community Management Solutions
          </p>
        </div>
      </div>

    </div>
  );
}
