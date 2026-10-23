# -*- coding: utf-8 -*-
"""Подмена pywin32 (pythoncom, pywintypes, win32com) для прогона макросов КОМПАС без Windows.

Обёртки типов — настоящие модули gen_py, созданные pywin32 из библиотек типов КОМПАС-3D v25 (gen_py.zip рядом).
Поэтому имена свойств и методов, их аргументы и типы проверяются так же, как в настоящем КОМПАС:
нет свойства у интерфейса — AttributeError; не передан обязательный аргумент или передан не тот тип — com_error
«Несовпадение типов»; QueryInterface к интерфейсу, которого у объекта нет, — com_error E_NOINTERFACE.
Сами объекты КОМПАС (документы, размеры, обозначения) — в model.py."""
import sys, os, types, zipfile, importlib.util, threading

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- pythoncom / pywintypes
class com_error(Exception):
    pass


class _Sentinel:
    def __init__(self, n):
        self.n = n

    def __repr__(self):
        return '<pythoncom.%s>' % self.n

    def __bool__(self):
        return False


pythoncom = types.ModuleType('pythoncom')
pythoncom.Empty = _Sentinel('Empty')
pythoncom.Missing = _Sentinel('Missing')
pythoncom.ArgNotFound = _Sentinel('ArgNotFound')
pythoncom.com_error = com_error
pythoncom.error = com_error
pythoncom.IID_IDispatch = '{00020400-0000-0000-C000-000000000046}'
pythoncom.IID_IUnknown = '{00000000-0000-0000-C000-000000000046}'
for _n, _v in dict(VT_EMPTY=0, VT_NULL=1, VT_I2=2, VT_I4=3, VT_R4=4, VT_R8=5, VT_BSTR=8, VT_DISPATCH=9, VT_ERROR=10, VT_BOOL=11,
                   VT_VARIANT=12, VT_UNKNOWN=13, VT_I1=16, VT_UI1=17, VT_UI4=19, VT_I8=20, VT_INT=22, VT_ARRAY=8192, VT_BYREF=16384).items():
    setattr(pythoncom, _n, _v)
pythoncom.DISPATCH_METHOD, pythoncom.DISPATCH_PROPERTYGET, pythoncom.DISPATCH_PROPERTYPUT = 1, 2, 4
pythoncom.CoInitialize = pythoncom.CoUninitialize = lambda *a: None
pythoncom.CoInitializeEx = lambda *a: None
pythoncom.PumpWaitingMessages = lambda *a: None


def _new(clsid):
    raise com_error(-2147221164, 'Класс не зарегистрирован', None, None)


pythoncom.new = _new

pywintypes = types.ModuleType('pywintypes')
pywintypes.com_error = com_error
pywintypes.error = com_error
pywintypes.IID = lambda s, *a: str(s).upper()
pywintypes.Time = lambda *a: 0

E_TYPE = (-2147352571, 'Несовпадение типов.')
E_NOIF = (-2147467262, 'Интерфейс не поддерживается')
E_PARAM = (-2147352561, 'Параметр не является необязательным.')


def raise_com(e, argerr=None):
    raise com_error(e[0], e[1], None, argerr)


# ---------------------------------------------------------------- реестр интерфейсов gen_py
CLASSES = {}      # CLSID (верхний регистр) -> класс gen_py
NAMES = {}        # имя интерфейса -> CLSID
_TLS = threading.local()


def iface_name(clsid):
    c = CLASSES.get(str(clsid).upper())
    return c.__name__ if c else None


# ---------------------------------------------------------------- «PyIDispatch»: вызовы gen_py передаются объекту модели
_VT_NUM = {2, 3, 4, 5, 16, 17, 18, 19, 20, 21, 22, 23, 6, 7}


def check_arg(v, vt, flags, name, i):
    """Аргумент против типа из библиотеки типов. Как в КОМПАС: Empty в обязательном — «Несовпадение типов»."""
    opt = flags & 16 or flags & 32
    if vt & 16384 or (flags & 2 and not flags & 1):      # out/by-ref — pywin32 передаёт что угодно
        return
    if v is pythoncom.Missing or v is pythoncom.ArgNotFound:
        if opt:
            return
        raise_com(E_PARAM, i + 1)
    if v is pythoncom.Empty:
        if opt:
            return
        raise_com(E_TYPE, i + 1)
    base = vt & 0xFFF
    if vt & 16384:      # out/by-ref — pywin32 передаёт что угодно
        return
    if vt & 8192:       # SAFEARRAY
        if not isinstance(v, (list, tuple, VARIANT)):
            raise_com(E_TYPE, i + 1)
        return
    if base in _VT_NUM:
        if isinstance(v, VARIANT):
            v = v.value
        if isinstance(v, str) or v is None or not isinstance(v, (int, float)):
            try:
                float(v)
            except Exception:
                raise_com(E_TYPE, i + 1)
    elif base == 11:
        if not isinstance(v, (bool, int)):
            raise_com(E_TYPE, i + 1)
    elif base == 8:
        if not isinstance(v, (str, int, float)):
            raise_com(E_TYPE, i + 1)
    elif base in (9, 13):
        if v is not None and not isinstance(v, (Ole, DispatchBaseClass, CDispatch)):
            raise_com(E_TYPE, i + 1)


def conv_ret(r, rt):
    vt = rt[0] if isinstance(rt, tuple) else rt
    base = vt & 0xFFF
    if r is None:
        return None
    if hasattr(r, '_kemu_impl_'):
        return Ole(r)
    if isinstance(r, (list, tuple)):
        return tuple(Ole(x) if hasattr(x, '_kemu_impl_') else x for x in r)
    if base == 11:
        return bool(r)
    if base in (2, 3, 16, 17, 18, 19, 20, 21, 22, 23):
        return int(r)
    if base in (4, 5):
        return float(r)
    return r


class Ole:
    """Аналог PyIDispatch: объект модели + интерфейс, через который к нему обращаются."""

    def __init__(self, impl, iface=None):
        self._impl = impl
        self._iface = iface

    def __repr__(self):
        return '<PyIDispatch %s %s>' % (type(self._impl).__name__, iface_name(self._iface) or '')

    def QueryInterface(self, iid, iid2=None):
        nm = iface_name(iid)
        if nm is None or not self._impl.supports(nm):
            self._impl.emu.note_qi(type(self._impl).__name__, nm or iid)
            raise_com(E_NOIF)
        return Ole(self._impl, str(iid).upper())

    def _call(self, name, kind, args, argtypes):
        for i, (v, at) in enumerate(zip(args, argtypes or ())):
            vt, fl = at if isinstance(at, tuple) else (at, 1)
            try:
                check_arg(v, vt, fl, name, i)
            except com_error:
                self._impl.emu.note_err('%s.%s(%s): аргумент %d — %s' % (iface_name(self._iface) or type(self._impl).__name__, name,
                                        ', '.join(repr(a) for a in args), i + 1, 'не передан' if v is pythoncom.Empty else 'не тот тип'))
                raise
        args = [None if a is pythoncom.Missing or a is pythoncom.Empty else (a.value if isinstance(a, VARIANT) else a) for a in args]
        args = [a._impl if isinstance(a, Ole) else a._oleobj_._impl if isinstance(a, (DispatchBaseClass, CDispatch)) else a for a in args]
        return self._impl.invoke(iface_name(self._iface), name, kind, args)

    def InvokeTypes(self, dispid, lcid, wFlags, retType, argTypes, *args):
        name = getattr(_TLS, 'name', None)
        _TLS.name = None
        if name is None:
            name = sys._getframe(1).f_code.co_name
            if name == '__call__':
                name = 'Item'
            elif name in ('__iter__',):
                name = '_NewEnum'
        kind = 'get' if wFlags == 2 and not args else 'call'
        return conv_ret(self._call(name, kind, args, argTypes), retType)

    def Invoke(self, dispid, lcid, wFlags, bResult, *args):
        name = getattr(_TLS, 'name', None)
        _TLS.name = None
        if wFlags in (4, 8):
            self._impl.invoke(iface_name(self._iface), name, 'put', [a._oleobj_._impl if isinstance(a, (DispatchBaseClass, CDispatch)) else a._impl if isinstance(a, Ole)
                                                                      else a.value if isinstance(a, VARIANT) else a for a in args])
            return None
        return self._call(name, 'call', args, None)

    def GetIDsOfNames(self, name):
        return 0


# ---------------------------------------------------------------- win32com.client
class VARIANT:
    def __init__(self, vt, value):
        self.varianttype = vt
        self.value = value


class DispatchBaseClass:
    def __init__(self, oobj=None):
        if oobj is None:
            raise_com(E_NOIF)
        if isinstance(oobj, (DispatchBaseClass, CDispatch)):
            oobj = oobj._oleobj_.QueryInterface(self.CLSID, pythoncom.IID_IDispatch)
        elif isinstance(oobj, Ole) and oobj._iface != str(self.CLSID).upper():
            oobj = Ole(oobj._impl, str(self.CLSID).upper())
        self.__dict__['_oleobj_'] = oobj

    def __repr__(self):
        return '<win32com.gen_py.KOMPAS.%s instance>' % type(self).__name__

    def __eq__(self, other):
        o = getattr(other, '_oleobj_', other)
        return isinstance(o, Ole) and o._impl is self._oleobj_._impl

    def __hash__(self):
        return id(self._oleobj_._impl)

    def __getattr__(self, attr):
        if attr.startswith('__'):
            raise AttributeError(attr)
        args = self._prop_map_get_.get(attr)
        if args is None:
            self._oleobj_._impl.emu.note_attr(type(self).__name__, attr, 'get')
            raise AttributeError("'%s' object has no attribute '%s'" % (repr(self), attr))
        return self._ApplyTypes_(*args)

    def __setattr__(self, attr, value):
        if attr in self.__dict__:
            self.__dict__[attr] = value
            return
        try:
            args, defArgs = self._prop_map_put_[attr]
        except KeyError:
            self._oleobj_._impl.emu.note_attr(type(self).__name__, attr, 'put')
            raise AttributeError("'%s' object has no attribute '%s'" % (repr(self), attr))
        g = self._prop_map_get_.get(attr)
        if g is not None:
            try:
                check_arg(value, g[2][0], 1, attr, 0)
            except com_error:
                self._oleobj_._impl.emu.note_err('%s.%s = %r: не тот тип' % (type(self).__name__, attr, value))
                raise
        _TLS.name = attr
        self._oleobj_.Invoke(*(args + (value,) + defArgs))

    def _ApplyTypes_(self, dispid, wFlags, retType, argTypes, user, resultCLSID, *args):
        _TLS.name = user
        return self._get_good_object_(self._oleobj_.InvokeTypes(dispid, 0, wFlags, retType, argTypes, *args), user, resultCLSID)

    def _get_good_object_(self, obj, obName=None, resultCLSID=None):
        if isinstance(obj, Ole):
            return Dispatch(obj, obName, resultCLSID)
        if isinstance(obj, tuple):
            return tuple(Dispatch(o, obName, resultCLSID) if isinstance(o, Ole) else o for o in obj)
        return obj

    def __bool__(self):
        return True


class CoClassBaseClass:
    def __init__(self, oobj=None):
        raise_com(E_NOIF)


class CDispatch:
    """Позднее связывание (объект без описания в библиотеке типов — например, структуры параметров API5, отданные как IDispatch)."""

    def __init__(self, ole):
        self.__dict__['_oleobj_'] = ole

    def __repr__(self):
        return '<COMObject %s>' % type(self._oleobj_._impl).__name__

    def __getattr__(self, attr):
        if attr.startswith('__'):
            raise AttributeError(attr)
        impl = self._oleobj_._impl
        cls = impl.dyn_class()
        if cls is not None:
            # тип объекта известен — проверка по его интерфейсу в gen_py
            return getattr(cls(Ole(impl, str(cls.CLSID).upper())), attr)
        return impl.dyn_get(attr)

    def __setattr__(self, attr, value):
        impl = self._oleobj_._impl
        cls = impl.dyn_class()
        if cls is not None:
            return setattr(cls(Ole(impl, str(cls.CLSID).upper())), attr, value)
        impl.invoke(None, attr, 'put', [value])


def Dispatch(obj, userName=None, resultCLSID=None, typeinfo=None, clsctx=None):
    if isinstance(obj, str):
        import model
        return CDispatch(Ole(model.EMU.progid(obj)))
    if isinstance(obj, (DispatchBaseClass, CDispatch)):
        obj = obj._oleobj_
    if resultCLSID is not None:
        cls = CLASSES.get(str(resultCLSID).upper())
        if cls is not None:
            return cls(Ole(obj._impl, str(resultCLSID).upper()))
    cls = obj._impl.dyn_class()
    if cls is not None:
        return cls(Ole(obj._impl, str(cls.CLSID).upper()))
    return CDispatch(obj)


class _Constants:
    def __init__(self):
        self.__dicts__ = []

    def __getattr__(self, a):
        for d in self.__dict__.get('__dicts__', []):
            if a in d:
                return d[a]
        raise AttributeError(a)


win32com = types.ModuleType('win32com')
win32com.__path__ = []
win32com.__gen_path__ = os.path.join(HERE, '_genpy_cache')
client = types.ModuleType('win32com.client')
client.Dispatch = Dispatch
client.DispatchEx = Dispatch
client.DispatchBaseClass = DispatchBaseClass
client.CoClassBaseClass = CoClassBaseClass
client.VARIANT = VARIANT
client.constants = _Constants()
client.CDispatch = CDispatch
client.GetActiveObject = lambda progid: Dispatch(progid)
client.__path__ = []
win32com.client = client

clsidtoclass = types.ModuleType('win32com.client.CLSIDToClass')


def _reg_dict(d):
    for k, v in d.items():
        CLASSES[str(k).upper()] = v
        NAMES[v.__name__] = str(k).upper()


clsidtoclass.RegisterCLSIDsFromDict = _reg_dict
clsidtoclass.RegisterCLSID = lambda clsid, cls: _reg_dict({clsid: cls})
clsidtoclass.GetClass = lambda clsid: CLASSES[str(clsid).upper()]
clsidtoclass.HasClass = lambda clsid: str(clsid).upper() in CLASSES
client.CLSIDToClass = clsidtoclass

util = types.ModuleType('win32com.client.util')


class Iterator:
    def __init__(self, enum, resultCLSID=None):
        self._it = iter(enum._impl.enum_items() if isinstance(enum, Ole) else enum)
        self._clsid = resultCLSID

    def __iter__(self):
        return self

    def __next__(self):
        v = next(self._it)
        return Dispatch(Ole(v), None, self._clsid) if hasattr(v, '_kemu_impl_') else v


util.Iterator = Iterator
client.util = util

gencache = types.ModuleType('win32com.client.gencache')
_MODS = {}
_GENZIP = os.path.join(HERE, 'gen_py.zip')


def EnsureModule(typelibCLSID, lcid, major, minor, *a, **kw):
    key = '%sx%sx%sx%s' % (str(typelibCLSID).strip('{}').upper(), lcid, major, minor)
    if key in _MODS:
        return _MODS[key]
    with zipfile.ZipFile(_GENZIP) as z:
        src = z.read('gen_py/%s.py' % key).decode('utf-8')
    m = types.ModuleType('win32com.gen_py.' + key)
    m.__file__ = os.path.join(HERE, 'gen_py', key + '.py')
    sys.modules[m.__name__] = m
    exec(compile(src, m.__file__, 'exec'), m.__dict__)
    _MODS[key] = m
    return m


gencache.EnsureModule = EnsureModule
gencache.EnsureDispatch = lambda progid, *a: Dispatch(progid)
gencache.is_readonly = False
gencache.is_zip = False
gencache.GetGeneratePath = lambda: win32com.__gen_path__
gencache.__init__ = lambda *a: None
client.gencache = gencache
genpy = types.ModuleType('win32com.gen_py')
genpy.__path__ = []
win32com.gen_py = genpy

win32api = types.ModuleType('win32api')
win32api.__file__ = os.path.join(HERE, 'win32', 'win32api.pyd')
win32gui = types.ModuleType('win32gui')
win32con = types.ModuleType('win32con')


def install():
    for n, m in {'pythoncom': pythoncom, 'pywintypes': pywintypes, 'win32com': win32com, 'win32com.client': client,
                 'win32com.client.CLSIDToClass': clsidtoclass, 'win32com.client.util': util, 'win32com.client.gencache': gencache,
                 'win32com.gen_py': genpy, 'win32api': win32api, 'win32gui': win32gui, 'win32con': win32con}.items():
        sys.modules[n] = m
    # все библиотеки типов КОМПАС сразу: классы, которые отдаёт одна библиотека, описаны в другой
    for k in ('75C9F5D0-B5B8-4526-8681-9903C567D2ED', '2CAF168C-7961-4B90-9DA2-701419BEEFE3', '0422828C-F174-495E-AC5D-D31014DBBE87', '69AC2981-37C0-4379-84FD-5DD2F3C0A520'):
        EnsureModule('{%s}' % k, 0, 1, 0)
