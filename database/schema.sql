IF OBJECT_ID(N'dbo.Usuarios_16776', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Usuarios_16776 (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Usuarios_16776_Id DEFAULT NEWID(),
    Nombre NVARCHAR(80) NOT NULL,
    Apellido NVARCHAR(80) NOT NULL,
    Correo NVARCHAR(320) NOT NULL,
    Telefono NVARCHAR(40) NOT NULL,
    PasswordHash NVARCHAR(100) NOT NULL,
    CreadoUtc DATETIME2(0) NOT NULL CONSTRAINT DF_Usuarios_16776_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Usuarios_16776 PRIMARY KEY (Id),
    CONSTRAINT UQ_Usuarios_16776_Correo UNIQUE (Correo)
  );
END;
GO
IF OBJECT_ID(N'dbo.Vehiculos_16776', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Vehiculos_16776 (
    Id INT IDENTITY(1,1) NOT NULL,
    PublicadorId UNIQUEIDENTIFIER NOT NULL,
    Anio SMALLINT NOT NULL,
    Tipo NVARCHAR(40) NOT NULL,
    Marca NVARCHAR(60) NOT NULL,
    Modelo NVARCHAR(80) NOT NULL,
    Motor NVARCHAR(60) NOT NULL,
    Transmision NVARCHAR(40) NOT NULL,
    Combustible NVARCHAR(40) NOT NULL,
    TrenManejo NVARCHAR(40) NOT NULL,
    Cilindros TINYINT NOT NULL,
    Dano NVARCHAR(12) NOT NULL,
    MontoBase DECIMAL(12,2) NOT NULL,
    OfertaActual DECIMAL(12,2) NULL,
    InicioUtc DATETIME2(0) NOT NULL,
    CierreUtc DATETIME2(0) NOT NULL,
    EsDemo BIT NOT NULL CONSTRAINT DF_Vehiculos_16776_Demo DEFAULT 0,
    CreadoUtc DATETIME2(0) NOT NULL CONSTRAINT DF_Vehiculos_16776_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Vehiculos_16776 PRIMARY KEY (Id),
    CONSTRAINT FK_Vehiculos_16776_Usuario FOREIGN KEY (PublicadorId) REFERENCES dbo.Usuarios_16776(Id),
    CONSTRAINT CK_Vehiculos_16776_Anio CHECK (Anio BETWEEN 1900 AND 2100),
    CONSTRAINT CK_Vehiculos_16776_Cilindros CHECK (Cilindros BETWEEN 1 AND 16),
    CONSTRAINT CK_Vehiculos_16776_Dano CHECK (Dano IN (N'verde', N'amarillo', N'rojo')),
    CONSTRAINT CK_Vehiculos_16776_Monto CHECK (MontoBase > 0),
    CONSTRAINT CK_Vehiculos_16776_Fecha CHECK (CierreUtc > InicioUtc)
  );
END;
GO
IF OBJECT_ID(N'dbo.FotosVehiculo_16776', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.FotosVehiculo_16776 (
    Id INT IDENTITY(1,1) NOT NULL,
    VehiculoId INT NOT NULL,
    Url NVARCHAR(2048) NOT NULL,
    Orden TINYINT NOT NULL,
    CONSTRAINT PK_FotosVehiculo_16776 PRIMARY KEY (Id),
    CONSTRAINT FK_FotosVehiculo_16776_Vehiculo FOREIGN KEY (VehiculoId) REFERENCES dbo.Vehiculos_16776(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_FotosVehiculo_16776_Orden UNIQUE (VehiculoId, Orden)
  );
END;
GO
IF OBJECT_ID(N'dbo.PujasVehiculo_16776', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PujasVehiculo_16776 (
    Id BIGINT IDENTITY(1,1) NOT NULL,
    VehiculoId INT NOT NULL,
    UsuarioId UNIQUEIDENTIFIER NOT NULL,
    Monto DECIMAL(12,2) NOT NULL,
    CreadaUtc DATETIME2(0) NOT NULL CONSTRAINT DF_PujasVehiculo_16776_Creada DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PujasVehiculo_16776 PRIMARY KEY (Id),
    CONSTRAINT FK_PujasVehiculo_16776_Vehiculo FOREIGN KEY (VehiculoId) REFERENCES dbo.Vehiculos_16776(Id),
    CONSTRAINT FK_PujasVehiculo_16776_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios_16776(Id),
    CONSTRAINT CK_PujasVehiculo_16776_Monto CHECK (Monto > 0)
  );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Vehiculos_16776_Filtros' AND object_id = OBJECT_ID(N'dbo.Vehiculos_16776'))
  CREATE INDEX IX_Vehiculos_16776_Filtros ON dbo.Vehiculos_16776 (Marca, Modelo, Anio, Tipo, Combustible);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PujasVehiculo_16776_Orden' AND object_id = OBJECT_ID(N'dbo.PujasVehiculo_16776'))
  CREATE INDEX IX_PujasVehiculo_16776_Orden ON dbo.PujasVehiculo_16776 (VehiculoId, Monto DESC, Id DESC) INCLUDE (UsuarioId, CreadaUtc);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_FotosVehiculo_16776_Vehiculo' AND object_id = OBJECT_ID(N'dbo.FotosVehiculo_16776'))
  CREATE INDEX IX_FotosVehiculo_16776_Vehiculo ON dbo.FotosVehiculo_16776 (VehiculoId, Orden);
GO
