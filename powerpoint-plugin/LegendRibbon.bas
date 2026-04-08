Attribute VB_Name = "LegendRibbon"
Option Explicit

Private pRibbon As IRibbonUI
Private pNextLeft As Single
Private pNextTop As Single

Private Const POINTS_PER_INCH As Double = 72#
Private Const DEFAULT_SHAPE_HEIGHT_IN As Double = 0.71
Private Const DEFAULT_SHAPE_WIDTH_IN As Double = 2.12
Private Const DEFAULT_LINE_LENGTH_IN As Double = 1.1

Private pStandardShapeHeightIn As Double
Private pStandardShapeWidthIn As Double

' Ribbon callback
Public Sub OnRibbonLoad(ribbon As IRibbonUI)
    Set pRibbon = ribbon
    pStandardShapeHeightIn = DEFAULT_SHAPE_HEIGHT_IN
    pStandardShapeWidthIn = DEFAULT_SHAPE_WIDTH_IN
End Sub

' ===== Size controls =====
Public Sub SetStandardSize(control As IRibbonControl)
    Dim newHeight As String
    Dim newWidth As String

    newHeight = InputBox("Standard shape height (inches):", "Set Shape Height", CStr(pStandardShapeHeightIn))
    If Len(newHeight) = 0 Then Exit Sub

    newWidth = InputBox("Standard shape width (inches):", "Set Shape Width", CStr(pStandardShapeWidthIn))
    If Len(newWidth) = 0 Then Exit Sub

    If Not IsNumeric(newHeight) Or Not IsNumeric(newWidth) Then
        MsgBox "Please enter numeric values.", vbExclamation
        Exit Sub
    End If

    If CDbl(newHeight) <= 0 Or CDbl(newWidth) <= 0 Then
        MsgBox "Size values must be greater than zero.", vbExclamation
        Exit Sub
    End If

    pStandardShapeHeightIn = CDbl(newHeight)
    pStandardShapeWidthIn = CDbl(newWidth)
    MsgBox "Standard size updated to " & Format(pStandardShapeHeightIn, "0.00") & """ high x " & _
           Format(pStandardShapeWidthIn, "0.00") & """ wide.", vbInformation
End Sub

Public Sub ResetStandardSize(control As IRibbonControl)
    pStandardShapeHeightIn = DEFAULT_SHAPE_HEIGHT_IN
    pStandardShapeWidthIn = DEFAULT_SHAPE_WIDTH_IN
    MsgBox "Standard size reset to 0.71"" high x 2.12"" wide.", vbInformation
End Sub

' ===== Entity buttons =====
Public Sub AddUSCorporation(control As IRibbonControl)
    AddLegendShape msoShapeRectangle, RGB(255, 255, 255), "U.S. Corporation"
End Sub

Public Sub AddControlledForeignCorporation(control As IRibbonControl)
    AddLegendShape msoShapeRectangle, RGB(246, 191, 0), "Controlled Foreign Corporation"
End Sub

Public Sub AddUSDisregardedEntity(control As IRibbonControl)
    AddDisregardedEntity RGB(105, 209, 211), "U.S. Disregarded Entity"
End Sub

Public Sub AddForeignDisregardedEntity(control As IRibbonControl)
    AddDisregardedEntity RGB(145, 204, 78), "Foreign Disregarded Entity"
End Sub

Public Sub AddUSPartnership(control As IRibbonControl)
    AddLegendShape msoShapeIsoscelesTriangle, RGB(215, 119, 201), "U.S. Partnership"
End Sub

Public Sub AddControlledForeignPartnership(control As IRibbonControl)
    AddLegendShape msoShapeIsoscelesTriangle, RGB(157, 103, 204), "Controlled Foreign Partnership"
End Sub

Public Sub AddBranch(control As IRibbonControl)
    AddLegendShape msoShapeOval, RGB(145, 204, 78), "Branch"
End Sub

Public Sub AddIndividual(control As IRibbonControl)
    AddCircleLike RGB(206, 220, 231), "Individual", False
End Sub

Public Sub AddUnrelated(control As IRibbonControl)
    AddCircleLike RGB(215, 215, 215), "Unrelated", True
End Sub

Public Sub AddTransactionalStep(control As IRibbonControl)
    Dim shp As Shape

    Set shp = AddCircleLike(RGB(235, 235, 235), "Transactional Step", False)
    With shp.TextFrame2.TextRange
        .Text = "1"
        .Font.Size = 10
        .Font.Fill.ForeColor.RGB = RGB(0, 0, 0)
        .ParagraphFormat.Alignment = msoAlignCenter
    End With
End Sub

' ===== Line buttons =====
Public Sub AddEquityLine(control As IRibbonControl)
    Dim sld As Slide
    Dim y As Single

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Sub

    y = GetNextTop(False)
    AddLineBase sld, pNextLeft, y, pNextLeft + InchesToPoints(DEFAULT_LINE_LENGTH_IN), y, RGB(0, 0, 0), msoFalse, msoFalse
    AdvancePosition
End Sub

Public Sub AddDebtLine(control As IRibbonControl)
    Dim sld As Slide
    Dim y As Single

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Sub

    y = GetNextTop(False)
    AddLineBase sld, pNextLeft, y, pNextLeft + InchesToPoints(DEFAULT_LINE_LENGTH_IN), y, RGB(0, 0, 0), msoTrue, msoTrue
    AdvancePosition
End Sub

Public Sub AddSeparatorLine(control As IRibbonControl)
    Dim sld As Slide
    Dim y As Single
    Dim l1 As Shape
    Dim l2 As Shape

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Sub

    y = GetNextTop(False)
    Set l1 = AddLineBase(sld, pNextLeft, y + 6, pNextLeft + InchesToPoints(DEFAULT_LINE_LENGTH_IN), y - 8, RGB(0, 0, 0), msoFalse, msoFalse)
    Set l2 = AddLineBase(sld, pNextLeft + 8, y + 12, pNextLeft + InchesToPoints(DEFAULT_LINE_LENGTH_IN) + 8, y - 2, RGB(0, 0, 0), msoFalse, msoFalse)
    l1.Name = "Legend Separator 1"
    l2.Name = "Legend Separator 2"
    AdvancePosition
End Sub

Public Sub AddActionStepLine(control As IRibbonControl)
    Dim sld As Slide
    Dim y As Single

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Sub

    y = GetNextTop(False)
    AddLineBase sld, pNextLeft, y, pNextLeft + InchesToPoints(DEFAULT_LINE_LENGTH_IN), y, RGB(196, 18, 48), msoTrue, msoFalse
    AdvancePosition
End Sub

Public Sub AddLiquidationMark(control As IRibbonControl)
    Dim sld As Slide
    Dim y As Single
    Dim xSize As Single

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Sub

    y = GetNextTop(False)
    xSize = InchesToPoints(0.8)

    AddLineBase sld, pNextLeft, y - xSize / 2, pNextLeft + xSize, y + xSize / 2, RGB(255, 0, 0), msoTrue, msoFalse
    AddLineBase sld, pNextLeft, y + xSize / 2, pNextLeft + xSize, y - xSize / 2, RGB(255, 0, 0), msoTrue, msoFalse
    AdvancePosition
End Sub

' ===== Helpers =====
Private Function AddLegendShape(shapeType As MsoAutoShapeType, fillColor As Long, shapeName As String) As Shape
    Dim sld As Slide
    Dim shp As Shape

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Function

    InitializePosition

    Set shp = sld.Shapes.AddShape(shapeType, pNextLeft, pNextTop, InchesToPoints(pStandardShapeWidthIn), InchesToPoints(pStandardShapeHeightIn))
    shp.Name = shapeName
    shp.Fill.ForeColor.RGB = fillColor
    shp.Line.ForeColor.RGB = RGB(0, 0, 0)
    shp.Line.Weight = 1.5

    AdvancePosition
    Set AddLegendShape = shp
End Function

Private Sub AddDisregardedEntity(fillColor As Long, shapeName As String)
    Dim sld As Slide
    Dim baseRect As Shape
    Dim inset As Single
    Dim innerOval As Shape

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Sub

    Set baseRect = AddLegendShape(msoShapeRectangle, fillColor, shapeName)
    If baseRect Is Nothing Then Exit Sub

    inset = InchesToPoints(0.03)
    Set innerOval = sld.Shapes.AddShape(msoShapeOval, baseRect.Left + inset, baseRect.Top + inset, baseRect.Width - (2 * inset), baseRect.Height - (2 * inset))

    innerOval.Fill.Transparency = 1
    innerOval.Line.ForeColor.RGB = RGB(0, 0, 0)
    innerOval.Line.Weight = 1.25
    innerOval.Name = shapeName & " Inner"
End Sub

Private Function AddCircleLike(fillColor As Long, shapeName As String, useOctagon As Boolean) As Shape
    Dim sld As Slide
    Dim shp As Shape
    Dim sideLength As Single
    Dim shpType As MsoAutoShapeType

    Set sld = GetTargetSlide()
    If sld Is Nothing Then Exit Function

    InitializePosition

    sideLength = InchesToPoints(0.71)
    shpType = IIf(useOctagon, msoShapeOctagon, msoShapeOval)

    Set shp = sld.Shapes.AddShape(shpType, pNextLeft, pNextTop, sideLength, sideLength)
    shp.Name = shapeName
    shp.Fill.ForeColor.RGB = fillColor
    shp.Line.ForeColor.RGB = RGB(0, 0, 0)
    shp.Line.Weight = 1.5

    AdvancePosition
    Set AddCircleLike = shp
End Function

Private Function AddLineBase(sld As Slide, x1 As Single, y1 As Single, x2 As Single, y2 As Single, rgbColor As Long, dashed As MsoTriState, arrowEnd As MsoTriState) As Shape
    Dim lineShp As Shape

    Set lineShp = sld.Shapes.AddLine(x1, y1, x2, y2)
    lineShp.Line.ForeColor.RGB = rgbColor
    lineShp.Line.Weight = 1.5
    lineShp.Line.DashStyle = IIf(dashed = msoTrue, msoLineDash, msoLineSolid)
    If arrowEnd = msoTrue Then
        lineShp.Line.EndArrowheadStyle = msoArrowheadTriangle
    Else
        lineShp.Line.EndArrowheadStyle = msoArrowheadNone
    End If
    Set AddLineBase = lineShp
End Function

Private Function GetTargetSlide() As Slide
    On Error GoTo ErrHandler
    If ActiveWindow Is Nothing Then
        MsgBox "Open a presentation and select a slide first.", vbExclamation
        Exit Function
    End If

    Set GetTargetSlide = ActiveWindow.View.Slide
    Exit Function

ErrHandler:
    MsgBox "Could not identify an active slide. Please switch to Normal view and select a slide.", vbExclamation
End Function

Private Function InchesToPoints(inches As Double) As Single
    InchesToPoints = CSng(inches * POINTS_PER_INCH)
End Function

Private Sub InitializePosition()
    If pNextLeft = 0 Then pNextLeft = InchesToPoints(1)
    If pNextTop = 0 Then pNextTop = InchesToPoints(1.2)
End Sub

Private Function GetNextTop(isShape As Boolean) As Single
    InitializePosition
    GetNextTop = pNextTop
End Function

Private Sub AdvancePosition()
    Dim stepHeightIn As Double

    stepHeightIn = pStandardShapeHeightIn
    If stepHeightIn < 0.5 Then stepHeightIn = 0.5

    pNextTop = pNextTop + InchesToPoints(stepHeightIn + 0.18)
End Sub
